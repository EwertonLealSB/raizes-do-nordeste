// src/infrastructure/repositories/index.js
const { getDb } = require('../database/connection');

// ─── Repositório de Usuários ───────────────────────────────────────────────
const UsuarioRepository = {
  findByEmail(email) {
    return getDb().prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email);
  },
  findById(id) {
    return getDb().prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(id);
  },
  create({ nome, email, senhaHash, perfil, lgpdConsentimento }) {
    const stmt = getDb().prepare(`
      INSERT INTO usuarios (nome, email, senha_hash, perfil, lgpd_consentimento)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(nome, email, senhaHash, perfil, lgpdConsentimento ? 1 : 0);
  },
  findAll({ page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;
    return getDb().prepare('SELECT id, nome, email, perfil, lgpd_consentimento, ativo, created_at FROM usuarios LIMIT ? OFFSET ?').all(limit, offset);
  },
  countAll() {
    return getDb().prepare('SELECT COUNT(*) as total FROM usuarios').get();
  },
};

// ─── Repositório de Unidades ──────────────────────────────────────────────
const UnidadeRepository = {
  findAll() {
    return getDb().prepare('SELECT * FROM unidades WHERE ativa = 1').all();
  },
  findById(id) {
    return getDb().prepare('SELECT * FROM unidades WHERE id = ? AND ativa = 1').get(id);
  },
  create({ nome, endereco, cidade, estado }) {
    return getDb().prepare('INSERT INTO unidades (nome, endereco, cidade, estado) VALUES (?, ?, ?, ?)').run(nome, endereco, cidade, estado);
  },
};

// ─── Repositório de Produtos ──────────────────────────────────────────────
const ProdutoRepository = {
  findAll({ page = 1, limit = 10, categoria } = {}) {
    const offset = (page - 1) * limit;
    if (categoria) {
      return getDb().prepare('SELECT * FROM produtos WHERE ativo = 1 AND categoria = ? LIMIT ? OFFSET ?').all(categoria, limit, offset);
    }
    return getDb().prepare('SELECT * FROM produtos WHERE ativo = 1 LIMIT ? OFFSET ?').all(limit, offset);
  },
  countAll(categoria) {
    if (categoria) return getDb().prepare('SELECT COUNT(*) as total FROM produtos WHERE ativo = 1 AND categoria = ?').get(categoria);
    return getDb().prepare('SELECT COUNT(*) as total FROM produtos WHERE ativo = 1').get();
  },
  findById(id) {
    return getDb().prepare('SELECT * FROM produtos WHERE id = ? AND ativo = 1').get(id);
  },
  findByIds(ids) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return getDb().prepare(`SELECT * FROM produtos WHERE id IN (${placeholders}) AND ativo = 1`).all(...ids);
  },
  create({ nome, descricao, preco, categoria }) {
    return getDb().prepare('INSERT INTO produtos (nome, descricao, preco, categoria) VALUES (?, ?, ?, ?)').run(nome, descricao, preco, categoria);
  },
  update(id, { nome, descricao, preco, categoria, ativo }) {
    return getDb().prepare(`
      UPDATE produtos SET nome=COALESCE(?,nome), descricao=COALESCE(?,descricao),
      preco=COALESCE(?,preco), categoria=COALESCE(?,categoria),
      ativo=COALESCE(?,ativo), updated_at=datetime('now') WHERE id=?
    `).run(nome, descricao, preco, categoria, ativo, id);
  },
};

// ─── Repositório de Estoques ──────────────────────────────────────────────
const EstoqueRepository = {
  findByUnidadeEProduto(unidadeId, produtoId) {
    return getDb().prepare('SELECT * FROM estoques WHERE unidade_id = ? AND produto_id = ?').get(unidadeId, produtoId);
  },
  findByUnidade(unidadeId) {
    return getDb().prepare(`
      SELECT e.*, p.nome as produto_nome, p.categoria FROM estoques e
      JOIN produtos p ON e.produto_id = p.id WHERE e.unidade_id = ?
    `).all(unidadeId);
  },
  atualizarQuantidade(unidadeId, produtoId, novaQuantidade) {
    return getDb().prepare(`
      UPDATE estoques SET quantidade = ?, updated_at = datetime('now')
      WHERE unidade_id = ? AND produto_id = ?
    `).run(novaQuantidade, unidadeId, produtoId);
  },
  registrarMovimento({ unidadeId, produtoId, tipo, quantidade, usuarioId, observacao }) {
    return getDb().prepare(`
      INSERT INTO movimentos_estoque (unidade_id, produto_id, tipo, quantidade, usuario_id, observacao)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(unidadeId, produtoId, tipo, quantidade, usuarioId, observacao);
  },
  findMovimentos(unidadeId, produtoId) {
    return getDb().prepare(`
      SELECT m.*, u.nome as usuario_nome FROM movimentos_estoque m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.unidade_id = ? AND m.produto_id = ?
      ORDER BY m.created_at DESC
    `).all(unidadeId, produtoId);
  },
};

// ─── Repositório de Pedidos ──────────────────────────────────────────────
const PedidoRepository = {
  create({ clienteId, unidadeId, canalPedido, formaPagamento, total }) {
    return getDb().prepare(`
      INSERT INTO pedidos (cliente_id, unidade_id, canal_pedido, forma_pagamento, total)
      VALUES (?, ?, ?, ?, ?)
    `).run(clienteId, unidadeId, canalPedido, formaPagamento, total);
  },
  addItem({ pedidoId, produtoId, quantidade, precoUnitario }) {
    return getDb().prepare(`
      INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
      VALUES (?, ?, ?, ?)
    `).run(pedidoId, produtoId, quantidade, precoUnitario);
  },
  findById(id) {
    const pedido = getDb().prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (pedido) {
      pedido.itens = getDb().prepare(`
        SELECT ip.*, p.nome as produto_nome FROM itens_pedido ip
        JOIN produtos p ON ip.produto_id = p.id WHERE ip.pedido_id = ?
      `).all(id);
    }
    return pedido;
  },
  findAll({ page = 1, limit = 10, canalPedido, status, clienteId, unidadeId } = {}) {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM pedidos WHERE 1=1';
    const params = [];
    if (canalPedido) { query += ' AND canal_pedido = ?'; params.push(canalPedido); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (clienteId) { query += ' AND cliente_id = ?'; params.push(clienteId); }
    if (unidadeId) { query += ' AND unidade_id = ?'; params.push(unidadeId); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return getDb().prepare(query).all(...params);
  },
  countAll({ canalPedido, status, clienteId, unidadeId } = {}) {
    let query = 'SELECT COUNT(*) as total FROM pedidos WHERE 1=1';
    const params = [];
    if (canalPedido) { query += ' AND canal_pedido = ?'; params.push(canalPedido); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (clienteId) { query += ' AND cliente_id = ?'; params.push(clienteId); }
    if (unidadeId) { query += ' AND unidade_id = ?'; params.push(unidadeId); }
    return getDb().prepare(query).get(...params);
  },
  updateStatus(id, status) {
    return getDb().prepare(`UPDATE pedidos SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
  },
};

// ─── Repositório de Pagamentos ────────────────────────────────────────────
const PagamentoRepository = {
  create({ pedidoId, forma, status, valor, payloadMock }) {
    return getDb().prepare(`
      INSERT INTO pagamentos (pedido_id, forma, status, valor, payload_mock)
      VALUES (?, ?, ?, ?, ?)
    `).run(pedidoId, forma, status, valor, JSON.stringify(payloadMock || {}));
  },
  findByPedido(pedidoId) {
    return getDb().prepare('SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY created_at DESC').all(pedidoId);
  },
  updateStatus(id, status) {
    return getDb().prepare(`UPDATE pagamentos SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
  },
};

// ─── Repositório de Fidelidade ────────────────────────────────────────────
const FidelidadeRepository = {
  findByCliente(clienteId) {
    return getDb().prepare('SELECT * FROM fidelidade WHERE cliente_id = ?').get(clienteId);
  },
  create(clienteId) {
    return getDb().prepare('INSERT INTO fidelidade (cliente_id, pontos) VALUES (?, 0)').run(clienteId);
  },
  updatePontos(clienteId, pontos) {
    return getDb().prepare(`UPDATE fidelidade SET pontos = ?, updated_at = datetime('now') WHERE cliente_id = ?`).run(pontos, clienteId);
  },
  registrarHistorico({ clienteId, tipo, pontos, descricao, pedidoId }) {
    return getDb().prepare(`
      INSERT INTO historico_fidelidade (cliente_id, tipo, pontos, descricao, pedido_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(clienteId, tipo, pontos, descricao, pedidoId);
  },
  findHistorico(clienteId) {
    return getDb().prepare(`SELECT * FROM historico_fidelidade WHERE cliente_id = ? ORDER BY created_at DESC`).all(clienteId);
  },
  updateConsentimento(clienteId, consentimento) {
    return getDb().prepare(`UPDATE fidelidade SET consentimento = ?, updated_at = datetime('now') WHERE cliente_id = ?`).run(consentimento ? 1 : 0, clienteId);
  },
};

// ─── Repositório de Auditoria ─────────────────────────────────────────────
const AuditRepository = {
  log({ usuarioId, acao, recurso, recursoId, detalhes, ip }) {
    try {
      getDb().prepare(`
        INSERT INTO audit_log (usuario_id, acao, recurso, recurso_id, detalhes, ip)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(usuarioId, acao, recurso, recursoId, JSON.stringify(detalhes || {}), ip);
    } catch (e) {
      // Log não deve quebrar a aplicação
      console.error('[AUDIT ERROR]', e.message);
    }
  },
  findAll({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    return getDb().prepare(`
      SELECT a.*, u.nome as usuario_nome FROM audit_log a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
  },
};

module.exports = {
  UsuarioRepository,
  UnidadeRepository,
  ProdutoRepository,
  EstoqueRepository,
  PedidoRepository,
  PagamentoRepository,
  FidelidadeRepository,
  AuditRepository,
};
