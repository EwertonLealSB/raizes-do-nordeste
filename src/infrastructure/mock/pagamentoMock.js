// src/infrastructure/mock/pagamentoMock.js
// Simula integração com gateway de pagamento externo

const { v4: uuidv4 } = require('uuid');

/**
 * Simula o envio de uma solicitação de pagamento ao gateway externo.
 * Retorna aprovado/recusado com base na taxa configurada.
 */
function simularPagamento({ pedidoId, valor, forma, clienteId }) {
  const taxaAprovacao = parseFloat(process.env.PAYMENT_MOCK_APPROVAL_RATE || '0.8');
  const aprovado = Math.random() <= taxaAprovacao;
  const transacaoId = uuidv4();

  const payload = {
    transacaoId,
    pedidoId,
    valor,
    forma,
    clienteId,
    gateway: 'MOCK_GATEWAY_v1',
    timestamp: new Date().toISOString(),
    status: aprovado ? 'APROVADO' : 'RECUSADO',
    mensagem: aprovado
      ? 'Pagamento processado com sucesso.'
      : 'Pagamento recusado pelo emissor. Verifique os dados ou tente outra forma.',
    codigoAutorizacao: aprovado ? `AUTH-${Math.floor(Math.random() * 999999)}` : null,
  };

  // Simula latência do gateway (~50-200ms) – em produção seria uma chamada HTTP real
  return new Promise((resolve) => {
    setTimeout(() => resolve(payload), Math.random() * 150 + 50);
  });
}

module.exports = { simularPagamento };
