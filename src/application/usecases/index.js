// src/application/usecases/index.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  UsuarioRepository, UnidadeRepository, ProdutoRepository,
  EstoqueRepository, PedidoRepository, PagamentoRepository,
  FidelidadeRepository, AuditRepository,
} = require('../../infrastructure/repositories');

const { simularPagamento } = require('../../infrastructure/mock/pagamentoMock');
const { Pedido, Estoque, Fidelidade, Usuario } = require('../../domain/entities');
const { StatusPedido, StatusPagamento, TipoMovimentoEstoque, PerfilUsuario } = require('../../domain/enums');
const {
  NaoEncontradoError, CredenciaisInvalidasError, ConflitoDadosError,
  ValidacaoError, EstoqueInsuficienteError,
} = require('../../domain/errors');

// ─── Auth ────────────────────────────────────────────────────────────────
const AuthUseCases = {
  async login({ email, senha }) {
    const row = UsuarioRepository.findByEmail(email);
    if (!row) throw new CredenciaisInvalidasError();

    const senhaValida = await bcrypt.compare(senha, row.senha_hash);
    if (!senhaValida) throw new CredenciaisInvalidasError();

    const payload = { id: row.id, perfil: row.perfil };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '3600'),
    });

    AuditRepository.log({ usuarioId: row.id, acao: 'LOGIN', recurso: 'auth', recursoId: String(row.id), detalhes: { email: row.email } });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '3600'),
      user: { id: row.id, nome: row.nome, email: row.email, perfil: row.perfil },
    };
  },

  async cadastrarUsuario({ nome, email, senha, perfil = 'CLIENTE', lgpdConsentimento = false }) {
    const existente = UsuarioRepository.findByEmail(email);
    if (existente) throw new ConflitoDadosError('E-mail já cadastrado.');

    const senhaHash = await bcrypt.hash(senha, 10);
    const result = UsuarioRepository.create({ nome, email, senhaHash, perfil, lgpdConsentimento });
    const novoId = result.lastInsertRowid;

    // Criar conta fidelidade automática para clientes com consentimento LGPD
    if (perfil === PerfilUsuario.CLIENTE && lgpdConsentimento) {
      FidelidadeRepository.create(novoId);
      FidelidadeRepository.updateConsentimento(novoId, true);
    }

    return UsuarioRepository.findById(novoId);
  },
};

// ─── Pedidos ─────────────────────────────────────────────────────────────
const PedidoUseCases = {
  async criarPedido({ clienteId, unidadeId, canalPedido, itens, formaPagamento }) {
    // Valida canal
    Pedido.validarCanal(canalPedido);

    // Valida unidade
    const unidade = UnidadeRepository.findById(unidadeId);
    if (!unidade) throw new NaoEncontradoError('Unidade', unidadeId);

    // Valida produtos e calcula total
    const ids = itens.map(i => i.produtoId);
    const produtos = ProdutoRepository.findByIds(ids);
    if (produtos.length !== ids.length) throw new NaoEncontradoError('Um ou mais produtos');

    let total = 0;
    const detalhesEstoqueInsuficiente = [];

    // Verifica estoque e calcula total em transação atômica
    const db = require('../../infrastructure/database/connection').getDb();
    const criarPedidoTx = db.transaction(() => {
      for (const item of itens) {
        const produto = produtos.find(p => p.id === item.produtoId);
        const estoqueRow = EstoqueRepository.findByUnidadeEProduto(unidadeId, item.produtoId);

        if (!estoqueRow || estoqueRow.quantidade < item.quantidade) {
          detalhesEstoqueInsuficiente.push({
            field: `itens[produtoId=${item.produtoId}].quantidade`,
            issue: `Disponível: ${estoqueRow ? estoqueRow.quantidade : 0}`,
          });
        } else {
          total += produto.preco * item.quantidade;
        }
      }

      if (detalhesEstoqueInsuficiente.length > 0) {
        throw new EstoqueInsuficienteError(detalhesEstoqueInsuficiente);
      }

      // Cria pedido
      const pedidoResult = PedidoRepository.create({
        clienteId, unidadeId, canalPedido, formaPagamento,
        total: parseFloat(total.toFixed(2)),
      });
      const pedidoId = pedidoResult.lastInsertRowid;

      // Insere itens e baixa estoque
      for (const item of itens) {
        const produto = produtos.find(p => p.id === item.produtoId);
        PedidoRepository.addItem({ pedidoId, produtoId: item.produtoId, quantidade: item.quantidade, precoUnitario: produto.preco });

        const estoqueRow = EstoqueRepository.findByUnidadeEProduto(unidadeId, item.produtoId);
        EstoqueRepository.atualizarQuantidade(unidadeId, item.produtoId, estoqueRow.quantidade - item.quantidade);
        EstoqueRepository.registrarMovimento({
          unidadeId, produtoId: item.produtoId, tipo: TipoMovimentoEstoque.SAIDA,
          quantidade: item.quantidade, usuarioId: clienteId, observacao: `Pedido #${pedidoId}`,
        });
      }

      return pedidoId;
    });

    const pedidoId = criarPedidoTx();

    AuditRepository.log({ usuarioId: clienteId, acao: 'CRIAR_PEDIDO', recurso: 'pedidos', recursoId: String(pedidoId), detalhes: { canalPedido, total } });

    return PedidoRepository.findById(pedidoId);
  },

  atualizarStatus({ pedidoId, novoStatus, usuarioId }) {
    const pedido = PedidoRepository.findById(pedidoId);
    if (!pedido) throw new NaoEncontradoError('Pedido', pedidoId);

    if (!Pedido.transicaoValida(pedido.status, novoStatus)) {
      throw new ConflitoDadosError(`Transição de "${pedido.status}" para "${novoStatus}" não é permitida.`);
    }

    PedidoRepository.updateStatus(pedidoId, novoStatus);
    AuditRepository.log({ usuarioId, acao: 'ATUALIZAR_STATUS_PEDIDO', recurso: 'pedidos', recursoId: String(pedidoId), detalhes: { de: pedido.status, para: novoStatus } });

    return PedidoRepository.findById(pedidoId);
  },

  listarPedidos({ page, limit, canalPedido, status, clienteId, unidadeId }) {
    const pedidos = PedidoRepository.findAll({ page, limit, canalPedido, status, clienteId, unidadeId });
    const { total } = PedidoRepository.countAll({ canalPedido, status, clienteId, unidadeId });
    return { data: pedidos, total, page: parseInt(page), limit: parseInt(limit) };
  },

  buscarPedido(id) {
    const pedido = PedidoRepository.findById(id);
    if (!pedido) throw new NaoEncontradoError('Pedido', id);
    return pedido;
  },
};

// ─── Pagamentos ──────────────────────────────────────────────────────────
const PagamentoUseCases = {
  async processarPagamento({ pedidoId, usuarioId }) {
    const pedido = PedidoRepository.findById(pedidoId);
    if (!pedido) throw new NaoEncontradoError('Pedido', pedidoId);

    if (pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO) {
      throw new ConflitoDadosError(`Pedido já está com status "${pedido.status}". Não é possível processar pagamento.`);
    }

    // Chama mock de pagamento (simulação de gateway externo)
    const resultadoGateway = await simularPagamento({
      pedidoId, valor: pedido.total, forma: pedido.forma_pagamento, clienteId: pedido.cliente_id,
    });

    const statusPagamento = resultadoGateway.status === 'APROVADO'
      ? StatusPagamento.APROVADO : StatusPagamento.RECUSADO;

    // Registra pagamento
    const pagResult = PagamentoRepository.create({
      pedidoId, forma: pedido.forma_pagamento, status: statusPagamento,
      valor: pedido.total, payloadMock: resultadoGateway,
    });

    // Atualiza status do pedido se aprovado
    if (statusPagamento === StatusPagamento.APROVADO) {
      PedidoRepository.updateStatus(pedidoId, StatusPedido.PAGO);

      // Acumula pontos de fidelidade automaticamente se cliente tiver conta
      const fidelidade = FidelidadeRepository.findByCliente(pedido.cliente_id);
      if (fidelidade && fidelidade.consentimento) {
        const pontosGanhos = Math.floor(pedido.total / 10);
        if (pontosGanhos > 0) {
          FidelidadeRepository.updatePontos(pedido.cliente_id, fidelidade.pontos + pontosGanhos);
          FidelidadeRepository.registrarHistorico({
            clienteId: pedido.cliente_id, tipo: 'ACUMULO', pontos: pontosGanhos,
            descricao: `Compra - Pedido #${pedidoId}`, pedidoId,
          });
        }
      }
    }

    AuditRepository.log({
      usuarioId, acao: 'PROCESSAR_PAGAMENTO', recurso: 'pagamentos',
      recursoId: String(pagResult.lastInsertRowid),
      detalhes: { pedidoId, status: statusPagamento, valor: pedido.total },
    });

    return {
      pagamentoId: pagResult.lastInsertRowid,
      pedidoId,
      status: statusPagamento,
      valor: pedido.total,
      transacaoId: resultadoGateway.transacaoId,
      mensagem: resultadoGateway.mensagem,
      codigoAutorizacao: resultadoGateway.codigoAutorizacao,
    };
  },
};

// ─── Estoque ─────────────────────────────────────────────────────────────
const EstoqueUseCases = {
  movimentar({ unidadeId, produtoId, tipo, quantidade, usuarioId, observacao }) {
    const unidade = UnidadeRepository.findById(unidadeId);
    if (!unidade) throw new NaoEncontradoError('Unidade', unidadeId);

    const produto = ProdutoRepository.findById(produtoId);
    if (!produto) throw new NaoEncontradoError('Produto', produtoId);

    const estoqueRow = EstoqueRepository.findByUnidadeEProduto(unidadeId, produtoId);
    const estoqueAtual = estoqueRow ? estoqueRow.quantidade : 0;

    if (tipo === TipoMovimentoEstoque.SAIDA && estoqueAtual < quantidade) {
      throw new EstoqueInsuficienteError([{ field: 'quantidade', issue: `Disponível: ${estoqueAtual}` }]);
    }

    const novaQuantidade = tipo === TipoMovimentoEstoque.ENTRADA
      ? estoqueAtual + quantidade : estoqueAtual - quantidade;

    if (estoqueRow) {
      EstoqueRepository.atualizarQuantidade(unidadeId, produtoId, novaQuantidade);
    } else {
      const db = require('../../infrastructure/database/connection').getDb();
      db.prepare('INSERT INTO estoques (unidade_id, produto_id, quantidade) VALUES (?, ?, ?)').run(unidadeId, produtoId, novaQuantidade);
    }

    EstoqueRepository.registrarMovimento({ unidadeId, produtoId, tipo, quantidade, usuarioId, observacao });
    AuditRepository.log({ usuarioId, acao: `MOVIMENTACAO_ESTOQUE_${tipo}`, recurso: 'estoques', recursoId: `${unidadeId}-${produtoId}`, detalhes: { quantidade, novaQuantidade } });

    return EstoqueRepository.findByUnidadeEProduto(unidadeId, produtoId);
  },

  consultarPorUnidade(unidadeId) {
    const unidade = UnidadeRepository.findById(unidadeId);
    if (!unidade) throw new NaoEncontradoError('Unidade', unidadeId);
    return EstoqueRepository.findByUnidade(unidadeId);
  },
};

// ─── Fidelidade ───────────────────────────────────────────────────────────
const FidelidadeUseCases = {
  consultarSaldo(clienteId) {
    const fid = FidelidadeRepository.findByCliente(clienteId);
    if (!fid) throw new NaoEncontradoError('Conta de fidelidade para o cliente', clienteId);
    return fid;
  },

  resgatar({ clienteId, pontos }) {
    const fid = FidelidadeRepository.findByCliente(clienteId);
    if (!fid) throw new NaoEncontradoError('Conta de fidelidade');
    if (!fid.consentimento) throw new ConflitoDadosError('Cliente não deu consentimento para o programa de fidelidade.');

    const entidade = new Fidelidade(fid);
    entidade.resgatarPontos(pontos); // lança erro se insuficiente

    FidelidadeRepository.updatePontos(clienteId, entidade.pontos);
    FidelidadeRepository.registrarHistorico({ clienteId, tipo: 'RESGATE', pontos, descricao: 'Resgate de pontos solicitado pelo cliente' });

    AuditRepository.log({ usuarioId: clienteId, acao: 'RESGATE_FIDELIDADE', recurso: 'fidelidade', recursoId: String(clienteId), detalhes: { pontos } });
    return { pontosResgatados: pontos, saldoAtual: entidade.pontos };
  },

  atualizarConsentimento({ clienteId, consentimento }) {
    const fid = FidelidadeRepository.findByCliente(clienteId);
    if (!fid) {
      FidelidadeRepository.create(clienteId);
    }
    FidelidadeRepository.updateConsentimento(clienteId, consentimento);
    AuditRepository.log({ usuarioId: clienteId, acao: 'LGPD_CONSENTIMENTO_FIDELIDADE', recurso: 'fidelidade', recursoId: String(clienteId), detalhes: { consentimento } });
    return FidelidadeRepository.findByCliente(clienteId);
  },
};

module.exports = { AuthUseCases, PedidoUseCases, PagamentoUseCases, EstoqueUseCases, FidelidadeUseCases };
