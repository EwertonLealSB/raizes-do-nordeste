// src/domain/entities/index.js
// Entidades de domínio: regras de negócio puras, sem dependência de infraestrutura

const { StatusPedido, CanalPedido } = require('../enums');
const { EstoqueInsuficienteError, ValidacaoError } = require('../errors');

class Pedido {
  constructor({ id, clienteId, unidadeId, canalPedido, status, formaPagamento, total, itens, createdAt, updatedAt }) {
    this.id = id;
    this.clienteId = clienteId;
    this.unidadeId = unidadeId;
    this.canalPedido = canalPedido;
    this.status = status || StatusPedido.AGUARDANDO_PAGAMENTO;
    this.formaPagamento = formaPagamento;
    this.total = total || 0;
    this.itens = itens || [];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Regra: transições de status válidas
  static transicaoValida(statusAtual, novoStatus) {
    const fluxo = {
      [StatusPedido.AGUARDANDO_PAGAMENTO]: [StatusPedido.PAGO, StatusPedido.CANCELADO],
      [StatusPedido.PAGO]: [StatusPedido.EM_PREPARO, StatusPedido.CANCELADO],
      [StatusPedido.EM_PREPARO]: [StatusPedido.PRONTO],
      [StatusPedido.PRONTO]: [StatusPedido.ENTREGUE],
      [StatusPedido.ENTREGUE]: [],
      [StatusPedido.CANCELADO]: [],
    };
    return fluxo[statusAtual]?.includes(novoStatus) ?? false;
  }

  // Regra: pedido pode ser cancelado?
  podeCancelar() {
    return [StatusPedido.AGUARDANDO_PAGAMENTO, StatusPedido.PAGO].includes(this.status);
  }

  // Regra: calcula total com base nos itens
  calcularTotal(produtos) {
    let total = 0;
    for (const item of this.itens) {
      const produto = produtos.find(p => p.id === item.produtoId);
      if (!produto) throw new ValidacaoError(`Produto ${item.produtoId} não encontrado.`);
      total += produto.preco * item.quantidade;
    }
    this.total = parseFloat(total.toFixed(2));
    return this.total;
  }

  // Regra: valida campo canalPedido
  static validarCanal(canal) {
    if (!Object.values(CanalPedido).includes(canal)) {
      throw new ValidacaoError(
        `Canal inválido: ${canal}. Valores aceitos: ${Object.values(CanalPedido).join(', ')}`,
        [{ field: 'canalPedido', issue: `Valor "${canal}" não é permitido.` }]
      );
    }
  }
}

class Produto {
  constructor({ id, nome, descricao, preco, categoria, ativo, createdAt }) {
    this.id = id;
    this.nome = nome;
    this.descricao = descricao;
    this.preco = preco;
    this.categoria = categoria;
    this.ativo = ativo !== undefined ? ativo : true;
    this.createdAt = createdAt;
  }
}

class Estoque {
  constructor({ id, unidadeId, produtoId, quantidade }) {
    this.id = id;
    this.unidadeId = unidadeId;
    this.produtoId = produtoId;
    this.quantidade = quantidade;
  }

  // Regra de negócio: verifica se há saldo suficiente
  verificarSaldo(qtdSolicitada) {
    if (this.quantidade < qtdSolicitada) {
      throw new EstoqueInsuficienteError([
        { field: 'quantidade', issue: `Disponível: ${this.quantidade}, solicitado: ${qtdSolicitada}` }
      ]);
    }
  }

  // Regra: baixa no estoque
  baixar(quantidade) {
    this.verificarSaldo(quantidade);
    this.quantidade -= quantidade;
    return this;
  }

  // Regra: entrada no estoque
  repor(quantidade) {
    if (quantidade <= 0) throw new ValidacaoError('Quantidade deve ser maior que zero.');
    this.quantidade += quantidade;
    return this;
  }
}

class Usuario {
  constructor({ id, nome, email, senhaHash, perfil, lgpdConsentimento, ativo, createdAt }) {
    this.id = id;
    this.nome = nome;
    this.email = email;
    this.senhaHash = senhaHash;
    this.perfil = perfil;
    this.lgpdConsentimento = lgpdConsentimento || false;
    this.ativo = ativo !== undefined ? ativo : true;
    this.createdAt = createdAt;
  }

  // LGPD: retorna dados sem expor campos sensíveis
  toPublic() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      perfil: this.perfil,
      lgpdConsentimento: this.lgpdConsentimento,
      ativo: this.ativo,
      createdAt: this.createdAt,
    };
  }
}

class Unidade {
  constructor({ id, nome, endereco, cidade, estado, ativa, createdAt }) {
    this.id = id;
    this.nome = nome;
    this.endereco = endereco;
    this.cidade = cidade;
    this.estado = estado;
    this.ativa = ativa !== undefined ? ativa : true;
    this.createdAt = createdAt;
  }
}

class Fidelidade {
  constructor({ id, clienteId, pontos, historico }) {
    this.id = id;
    this.clienteId = clienteId;
    this.pontos = pontos || 0;
    this.historico = historico || [];
  }

  // Regra: acumula pontos (1 ponto a cada R$10 gastos)
  acumularPontos(valorPedido) {
    const pontosGanhos = Math.floor(valorPedido / 10);
    this.pontos += pontosGanhos;
    return pontosGanhos;
  }

  // Regra: resgata pontos (mínimo 50 pontos)
  resgatarPontos(quantidade) {
    if (quantidade < 50) throw new ValidacaoError('Mínimo de 50 pontos para resgate.');
    if (this.pontos < quantidade) throw new ValidacaoError(`Saldo insuficiente. Disponível: ${this.pontos} pontos.`);
    this.pontos -= quantidade;
    return quantidade;
  }
}

module.exports = { Pedido, Produto, Estoque, Usuario, Unidade, Fidelidade };
