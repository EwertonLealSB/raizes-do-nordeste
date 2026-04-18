// src/api/controllers/index.js
const { AuthUseCases, PedidoUseCases, PagamentoUseCases, EstoqueUseCases, FidelidadeUseCases } = require('../../application/usecases');
const { UsuarioRepository, UnidadeRepository, ProdutoRepository, PagamentoRepository, AuditRepository } = require('../../infrastructure/repositories');
const { NaoEncontradoError, ValidacaoError } = require('../../domain/errors');
const { CanalPedido, StatusPedido, TipoMovimentoEstoque } = require('../../domain/enums');

// ─── Auth ────────────────────────────────────────────────────────────────
const AuthController = {
  async login(req, res, next) {
    try {
      const { email, senha } = req.body;
      const resultado = await AuthUseCases.login({ email, senha });
      res.json(resultado);
    } catch (err) { next(err); }
  },

  async cadastrar(req, res, next) {
    try {
      const { nome, email, senha, perfil, lgpdConsentimento } = req.body;
      const usuario = await AuthUseCases.cadastrarUsuario({ nome, email, senha, perfil, lgpdConsentimento });
      const { senha_hash, ...pub } = usuario;
      res.status(201).json(pub);
    } catch (err) { next(err); }
  },

  perfil(req, res) {
    const usuario = UsuarioRepository.findById(req.usuario.id);
    if (!usuario) return res.status(404).json({ error: 'NAO_ENCONTRADO', message: 'Usuário não encontrado.', details: [] });
    const { senha_hash, ...pub } = usuario;
    res.json(pub);
  },
};

// ─── Unidades ─────────────────────────────────────────────────────────────
const UnidadeController = {
  listar(req, res, next) {
    try {
      const unidades = UnidadeRepository.findAll();
      res.json({ data: unidades, total: unidades.length });
    } catch (err) { next(err); }
  },
  buscar(req, res, next) {
    try {
      const u = UnidadeRepository.findById(req.params.id);
      if (!u) throw new NaoEncontradoError('Unidade', req.params.id);
      res.json(u);
    } catch (err) { next(err); }
  },
  criar(req, res, next) {
    try {
      const { nome, endereco, cidade, estado } = req.body;
      const result = UnidadeRepository.create({ nome, endereco, cidade, estado });
      const nova = UnidadeRepository.findById(result.lastInsertRowid);
      res.status(201).json(nova);
    } catch (err) { next(err); }
  },
};

// ─── Produtos ─────────────────────────────────────────────────────────────
const ProdutoController = {
  listar(req, res, next) {
    try {
      const { page = 1, limit = 10, categoria } = req.query;
      const produtos = ProdutoRepository.findAll({ page: parseInt(page), limit: parseInt(limit), categoria });
      const { total } = ProdutoRepository.countAll(categoria);
      res.json({ data: produtos, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) { next(err); }
  },
  buscar(req, res, next) {
    try {
      const p = ProdutoRepository.findById(req.params.id);
      if (!p) throw new NaoEncontradoError('Produto', req.params.id);
      res.json(p);
    } catch (err) { next(err); }
  },
  criar(req, res, next) {
    try {
      const { nome, descricao, preco, categoria } = req.body;
      if (preco <= 0) throw new ValidacaoError('Preço deve ser maior que zero.', [{ field: 'preco', issue: 'Deve ser > 0' }]);
      const result = ProdutoRepository.create({ nome, descricao, preco: parseFloat(preco), categoria });
      res.status(201).json(ProdutoRepository.findById(result.lastInsertRowid));
    } catch (err) { next(err); }
  },
  atualizar(req, res, next) {
    try {
      const p = ProdutoRepository.findById(req.params.id);
      if (!p) throw new NaoEncontradoError('Produto', req.params.id);
      ProdutoRepository.update(req.params.id, req.body);
      res.json(ProdutoRepository.findById(req.params.id));
    } catch (err) { next(err); }
  },
  desativar(req, res, next) {
    try {
      const p = ProdutoRepository.findById(req.params.id);
      if (!p) throw new NaoEncontradoError('Produto', req.params.id);
      ProdutoRepository.update(req.params.id, { ativo: 0 });
      res.status(204).send();
    } catch (err) { next(err); }
  },
};

// ─── Estoque ──────────────────────────────────────────────────────────────
const EstoqueController = {
  consultar(req, res, next) {
    try {
      const estoque = EstoqueUseCases.consultarPorUnidade(req.params.unidadeId);
      res.json({ data: estoque });
    } catch (err) { next(err); }
  },
  movimentar(req, res, next) {
    try {
      const { produtoId, tipo, quantidade, observacao } = req.body;
      const tiposValidos = Object.values(TipoMovimentoEstoque);
      if (!tiposValidos.includes(tipo)) {
        throw new ValidacaoError(`Tipo inválido. Use: ${tiposValidos.join(', ')}`, [{ field: 'tipo', issue: 'Inválido' }]);
      }
      if (!quantidade || quantidade <= 0) {
        throw new ValidacaoError('Quantidade deve ser maior que zero.', [{ field: 'quantidade', issue: 'Deve ser > 0' }]);
      }
      const result = EstoqueUseCases.movimentar({
        unidadeId: parseInt(req.params.unidadeId),
        produtoId: parseInt(produtoId),
        tipo,
        quantidade: parseInt(quantidade),
        usuarioId: req.usuario.id,
        observacao,
      });
      res.json(result);
    } catch (err) { next(err); }
  },
};

// ─── Pedidos ──────────────────────────────────────────────────────────────
const PedidoController = {
  async criar(req, res, next) {
    try {
      const { unidadeId, canalPedido, itens, formaPagamento } = req.body;
      if (!Array.isArray(itens) || itens.length === 0) {
        throw new ValidacaoError('Itens do pedido são obrigatórios.', [{ field: 'itens', issue: 'Deve conter ao menos 1 item.' }]);
      }
      const pedido = await PedidoUseCases.criarPedido({
        clienteId: req.usuario.id,
        unidadeId: parseInt(unidadeId),
        canalPedido,
        itens: itens.map(i => ({ produtoId: parseInt(i.produtoId), quantidade: parseInt(i.quantidade) })),
        formaPagamento,
      });
      res.status(201).json(pedido);
    } catch (err) { next(err); }
  },
  listar(req, res, next) {
    try {
      const { page = 1, limit = 10, canalPedido, status, unidadeId } = req.query;
      // Clientes só veem os próprios pedidos
      const clienteId = req.usuario.perfil === 'CLIENTE' ? req.usuario.id : undefined;
      const resultado = PedidoUseCases.listarPedidos({ page: parseInt(page), limit: parseInt(limit), canalPedido, status, clienteId, unidadeId });
      res.json(resultado);
    } catch (err) { next(err); }
  },
  buscar(req, res, next) {
    try {
      const pedido = PedidoUseCases.buscarPedido(req.params.id);
      // Cliente só pode ver o próprio pedido
      if (req.usuario.perfil === 'CLIENTE' && pedido.cliente_id !== req.usuario.id) {
        throw new NaoEncontradoError('Pedido', req.params.id);
      }
      res.json(pedido);
    } catch (err) { next(err); }
  },
  atualizarStatus(req, res, next) {
    try {
      const { status } = req.body;
      if (!Object.values(StatusPedido).includes(status)) {
        throw new ValidacaoError(`Status inválido. Valores: ${Object.values(StatusPedido).join(', ')}`, [{ field: 'status', issue: 'Inválido' }]);
      }
      const pedido = PedidoUseCases.atualizarStatus({ pedidoId: parseInt(req.params.id), novoStatus: status, usuarioId: req.usuario.id });
      res.json(pedido);
    } catch (err) { next(err); }
  },
};

// ─── Pagamentos ───────────────────────────────────────────────────────────
const PagamentoController = {
  async processar(req, res, next) {
    try {
      const resultado = await PagamentoUseCases.processarPagamento({
        pedidoId: parseInt(req.params.pedidoId),
        usuarioId: req.usuario.id,
      });
      res.json(resultado);
    } catch (err) { next(err); }
  },
  listarPorPedido(req, res, next) {
    try {
      const pagamentos = PagamentoRepository.findByPedido(req.params.pedidoId);
      res.json({ data: pagamentos });
    } catch (err) { next(err); }
  },
};

// ─── Fidelidade ───────────────────────────────────────────────────────────
const FidelidadeController = {
  saldo(req, res, next) {
    try {
      const clienteId = req.params.clienteId ? parseInt(req.params.clienteId) : req.usuario.id;
      const fid = FidelidadeUseCases.consultarSaldo(clienteId);
      const { id, cliente_id, pontos, consentimento, created_at, updated_at } = fid;
      res.json({ clienteId: cliente_id, pontos, consentimento: !!consentimento, updated_at });
    } catch (err) { next(err); }
  },
  resgatar(req, res, next) {
    try {
      const { pontos } = req.body;
      if (!pontos || pontos < 50) throw new ValidacaoError('Mínimo de 50 pontos para resgate.', [{ field: 'pontos', issue: 'Deve ser >= 50' }]);
      const resultado = FidelidadeUseCases.resgatar({ clienteId: req.usuario.id, pontos: parseInt(pontos) });
      res.json(resultado);
    } catch (err) { next(err); }
  },
  consentimento(req, res, next) {
    try {
      const { consentimento } = req.body;
      const resultado = FidelidadeUseCases.atualizarConsentimento({ clienteId: req.usuario.id, consentimento: !!consentimento });
      res.json({ mensagem: 'Consentimento atualizado.', consentimento: !!resultado.consentimento });
    } catch (err) { next(err); }
  },
  historico(req, res, next) {
    try {
      const { FidelidadeRepository } = require('../../infrastructure/repositories');
      const hist = FidelidadeRepository.findHistorico(req.usuario.id);
      res.json({ data: hist });
    } catch (err) { next(err); }
  },
};

// ─── Auditoria ────────────────────────────────────────────────────────────
const AuditoriaController = {
  listar(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const logs = AuditRepository.findAll({ page: parseInt(page), limit: parseInt(limit) });
      res.json({ data: logs });
    } catch (err) { next(err); }
  },
};

module.exports = {
  AuthController, UnidadeController, ProdutoController,
  EstoqueController, PedidoController, PagamentoController,
  FidelidadeController, AuditoriaController,
};
