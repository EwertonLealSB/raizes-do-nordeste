// src/domain/enums/index.js

const CanalPedido = Object.freeze({
  APP: 'APP',
  TOTEM: 'TOTEM',
  BALCAO: 'BALCAO',
  PICKUP: 'PICKUP',
  WEB: 'WEB',
});

const StatusPedido = Object.freeze({
  AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
  PAGO: 'PAGO',
  EM_PREPARO: 'EM_PREPARO',
  PRONTO: 'PRONTO',
  ENTREGUE: 'ENTREGUE',
  CANCELADO: 'CANCELADO',
});

const PerfilUsuario = Object.freeze({
  ADMIN: 'ADMIN',
  GERENTE: 'GERENTE',
  ATENDENTE: 'ATENDENTE',
  COZINHA: 'COZINHA',
  CLIENTE: 'CLIENTE',
});

const StatusPagamento = Object.freeze({
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  RECUSADO: 'RECUSADO',
});

const FormaPagamento = Object.freeze({
  MOCK: 'MOCK',
  PIX: 'PIX',
  CARTAO_CREDITO: 'CARTAO_CREDITO',
  CARTAO_DEBITO: 'CARTAO_DEBITO',
  DINHEIRO: 'DINHEIRO',
});

const TipoMovimentoEstoque = Object.freeze({
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
});

module.exports = {
  CanalPedido,
  StatusPedido,
  PerfilUsuario,
  StatusPagamento,
  FormaPagamento,
  TipoMovimentoEstoque,
};
