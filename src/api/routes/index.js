// src/api/routes/index.js
const { Router } = require('express');
const {
  AuthController, UnidadeController, ProdutoController,
  EstoqueController, PedidoController, PagamentoController,
  FidelidadeController, AuditoriaController,
} = require('../controllers');
const { autenticar, autorizar } = require('../middlewares/auth');
const { requerer } = require('../middlewares/validate');

const router = Router();

// ─── /auth ────────────────────────────────────────────────────────────────
router.post('/auth/login', requerer('email', 'senha'), AuthController.login);
router.post('/auth/cadastro', requerer('nome', 'email', 'senha'), AuthController.cadastrar);
router.get('/auth/perfil', autenticar, AuthController.perfil);

// ─── /unidades ────────────────────────────────────────────────────────────
router.get('/unidades', autenticar, UnidadeController.listar);
router.get('/unidades/:id', autenticar, UnidadeController.buscar);
router.post('/unidades', autenticar, autorizar('ADMIN', 'GERENTE'), requerer('nome', 'endereco', 'cidade', 'estado'), UnidadeController.criar);

// ─── /produtos ────────────────────────────────────────────────────────────
router.get('/produtos', autenticar, ProdutoController.listar);
router.get('/produtos/:id', autenticar, ProdutoController.buscar);
router.post('/produtos', autenticar, autorizar('ADMIN', 'GERENTE'), requerer('nome', 'preco', 'categoria'), ProdutoController.criar);
router.patch('/produtos/:id', autenticar, autorizar('ADMIN', 'GERENTE'), ProdutoController.atualizar);
router.delete('/produtos/:id', autenticar, autorizar('ADMIN'), ProdutoController.desativar);

// ─── /estoque ─────────────────────────────────────────────────────────────
router.get('/estoque/:unidadeId', autenticar, EstoqueController.consultar);
router.post('/estoque/:unidadeId/movimentar', autenticar, autorizar('ADMIN', 'GERENTE', 'ATENDENTE'), requerer('produtoId', 'tipo', 'quantidade'), EstoqueController.movimentar);

// ─── /pedidos ─────────────────────────────────────────────────────────────
router.get('/pedidos', autenticar, PedidoController.listar);
router.post('/pedidos', autenticar, requerer('unidadeId', 'canalPedido', 'itens', 'formaPagamento'), PedidoController.criar);
router.get('/pedidos/:id', autenticar, PedidoController.buscar);
router.patch('/pedidos/:id/status', autenticar, autorizar('ADMIN', 'GERENTE', 'ATENDENTE', 'COZINHA'), requerer('status'), PedidoController.atualizarStatus);

// ─── /pagamentos ──────────────────────────────────────────────────────────
router.post('/pagamentos/pedido/:pedidoId/processar', autenticar, PagamentoController.processar);
router.get('/pagamentos/pedido/:pedidoId', autenticar, PagamentoController.listarPorPedido);

// ─── /fidelidade ──────────────────────────────────────────────────────────
router.get('/fidelidade/saldo', autenticar, autorizar('CLIENTE'), FidelidadeController.saldo);
router.get('/fidelidade/historico', autenticar, autorizar('CLIENTE'), FidelidadeController.historico);
router.post('/fidelidade/resgatar', autenticar, autorizar('CLIENTE'), requerer('pontos'), FidelidadeController.resgatar);
router.patch('/fidelidade/consentimento', autenticar, autorizar('CLIENTE'), FidelidadeController.consentimento);
// Admin pode consultar saldo de qualquer cliente
router.get('/fidelidade/saldo/:clienteId', autenticar, autorizar('ADMIN', 'GERENTE'), FidelidadeController.saldo);

// ─── /auditoria ───────────────────────────────────────────────────────────
router.get('/auditoria', autenticar, autorizar('ADMIN'), AuditoriaController.listar);

module.exports = router;
