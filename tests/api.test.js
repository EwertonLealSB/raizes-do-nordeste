// tests/api.test.js
// Plano de Testes - Raízes do Nordeste API
// Cobertura: autenticação, produtos, pedidos, pagamento mock, estoque, fidelidade

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key';
process.env.JWT_EXPIRES_IN = '3600';
process.env.DB_PATH = './test_database.sqlite';
process.env.PAYMENT_MOCK_APPROVAL_RATE = '1.0'; // 100% de aprovação em testes

const request = require('supertest');
const app = require('../src/server');
const { getDb, closeDb } = require('../src/infrastructure/database/connection');

let tokenCliente, tokenAdmin, tokenCozinha;
let pedidoId, pagamentoStatus;

// ─── Setup e Teardown ────────────────────────────────────────────────────
beforeAll(async () => {
  // Cria banco de testes do zero
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, email TEXT UNIQUE, senha_hash TEXT, perfil TEXT, lgpd_consentimento INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS unidades (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, endereco TEXT, cidade TEXT, estado TEXT, ativa INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS produtos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, descricao TEXT, preco REAL, categoria TEXT, ativo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS estoques (id INTEGER PRIMARY KEY AUTOINCREMENT, unidade_id INTEGER, produto_id INTEGER, quantidade INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')), UNIQUE(unidade_id, produto_id));
    CREATE TABLE IF NOT EXISTS movimentos_estoque (id INTEGER PRIMARY KEY AUTOINCREMENT, unidade_id INTEGER, produto_id INTEGER, tipo TEXT, quantidade INTEGER, usuario_id INTEGER, observacao TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER, unidade_id INTEGER, canal_pedido TEXT, status TEXT DEFAULT 'AGUARDANDO_PAGAMENTO', forma_pagamento TEXT, total REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS itens_pedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER, produto_id INTEGER, quantidade INTEGER, preco_unitario REAL);
    CREATE TABLE IF NOT EXISTS pagamentos (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER, forma TEXT, status TEXT, valor REAL, payload_mock TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS fidelidade (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER UNIQUE, pontos INTEGER DEFAULT 0, consentimento INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS historico_fidelidade (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER, tipo TEXT, pontos INTEGER, descricao TEXT, pedido_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER, acao TEXT, recurso TEXT, recurso_id TEXT, detalhes TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now')));
  `);

  // Seed de teste
  db.prepare("INSERT INTO unidades (nome, endereco, cidade, estado) VALUES ('Unidade Teste', 'Rua Teste, 1', 'Fortaleza', 'CE')").run();
  db.prepare("INSERT INTO produtos (nome, descricao, preco, categoria) VALUES ('Tapioca Test', 'desc', 18.90, 'Lanches')").run();
  db.prepare("INSERT INTO estoques (unidade_id, produto_id, quantidade) VALUES (1, 1, 50)").run();

  // Cadastra usuários de teste
  await request(app).post('/api/auth/cadastro').send({ nome: 'Admin Test', email: 'admin@test.com', senha: 'Senha@123', perfil: 'ADMIN', lgpdConsentimento: true });
  await request(app).post('/api/auth/cadastro').send({ nome: 'Cliente Test', email: 'cliente@test.com', senha: 'Senha@123', perfil: 'CLIENTE', lgpdConsentimento: true });
  await request(app).post('/api/auth/cadastro').send({ nome: 'Cozinha Test', email: 'cozinha@test.com', senha: 'Senha@123', perfil: 'COZINHA', lgpdConsentimento: false });

  // Login dos usuários
  const resAdmin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', senha: 'Senha@123' });
  const resCliente = await request(app).post('/api/auth/login').send({ email: 'cliente@test.com', senha: 'Senha@123' });
  const resCozinha = await request(app).post('/api/auth/login').send({ email: 'cozinha@test.com', senha: 'Senha@123' });

  tokenAdmin = resAdmin.body.accessToken;
  tokenCliente = resCliente.body.accessToken;
  tokenCozinha = resCozinha.body.accessToken;
});

afterAll(() => {
  closeDb();
  const fs = require('fs');
  if (fs.existsSync('./test_database.sqlite')) fs.unlinkSync('./test_database.sqlite');
});

// ─── T01: Login válido ────────────────────────────────────────────────────
describe('T01 - Login válido (Auth)', () => {
  test('Deve retornar 200 e accessToken com credenciais corretas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cliente@test.com', senha: 'Senha@123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('tokenType', 'Bearer');
    expect(res.body.user).toHaveProperty('perfil', 'CLIENTE');
  });
});

// ─── T02: Login com credenciais inválidas ────────────────────────────────
describe('T02 - Login inválido (Auth negativo)', () => {
  test('Deve retornar 401 com senha incorreta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cliente@test.com', senha: 'senhaErrada' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('CREDENCIAIS_INVALIDAS');
  });
});

// ─── T03: Acesso sem token (401) ─────────────────────────────────────────
describe('T03 - Acesso sem token (Auth negativo)', () => {
  test('GET /pedidos sem token deve retornar 401', async () => {
    const res = await request(app).get('/api/pedidos');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('NAO_AUTENTICADO');
  });
});

// ─── T04: Acesso com perfil sem permissão (403) ───────────────────────────
describe('T04 - Acesso com perfil sem permissão (Auth negativo)', () => {
  test('COZINHA tentando criar unidade deve retornar 403', async () => {
    const res = await request(app)
      .post('/api/unidades')
      .set('Authorization', `Bearer ${tokenCozinha}`)
      .send({ nome: 'X', endereco: 'X', cidade: 'X', estado: 'XX' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('SEM_PERMISSAO');
  });
});

// ─── T05: Listar produtos (positivo) ─────────────────────────────────────
describe('T05 - Listar produtos (positivo)', () => {
  test('Deve retornar 200 com lista paginada de produtos', async () => {
    const res = await request(app)
      .get('/api/produtos?page=1&limit=10')
      .set('Authorization', `Bearer ${tokenCliente}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });
});

// ─── T06: Campo obrigatório ausente (422) ────────────────────────────────
describe('T06 - Campo obrigatório ausente (negativo)', () => {
  test('POST /pedidos sem canalPedido deve retornar 422', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ unidadeId: 1, itens: [{ produtoId: 1, quantidade: 1 }], formaPagamento: 'MOCK' });
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('ERRO_VALIDACAO');
  });
});

// ─── T07: canalPedido inválido (422) ──────────────────────────────────────
describe('T07 - canalPedido inválido (negativo)', () => {
  test('POST /pedidos com canal inválido deve retornar 422', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ unidadeId: 1, canalPedido: 'INVALIDO', itens: [{ produtoId: 1, quantidade: 1 }], formaPagamento: 'MOCK' });
    expect(res.statusCode).toBe(422);
    expect(res.body.details[0].field).toBe('canalPedido');
  });
});

// ─── T08: Criar pedido válido (positivo) ─────────────────────────────────
describe('T08 - Criar pedido com itens válidos (positivo)', () => {
  test('Deve retornar 201 com pedido criado e status AGUARDANDO_PAGAMENTO', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ unidadeId: 1, canalPedido: 'TOTEM', itens: [{ produtoId: 1, quantidade: 2 }], formaPagamento: 'MOCK' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('AGUARDANDO_PAGAMENTO');
    expect(res.body.canal_pedido).toBe('TOTEM');
    expect(res.body.total).toBeCloseTo(37.80, 1);
    pedidoId = res.body.id;
  });
});

// ─── T09: Produto inexistente no pedido (404) ────────────────────────────
describe('T09 - Pedido com produto inexistente (negativo)', () => {
  test('Deve retornar 404 quando produto não existe', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ unidadeId: 1, canalPedido: 'APP', itens: [{ produtoId: 9999, quantidade: 1 }], formaPagamento: 'MOCK' });
    expect(res.statusCode).toBe(404);
  });
});

// ─── T10: Pagamento mock aprovado → status PAGO ───────────────────────────
describe('T10 - Pagamento mock aprovado (positivo)', () => {
  test('Deve retornar APROVADO e pedido deve mudar para PAGO', async () => {
    expect(pedidoId).toBeDefined();
    const res = await request(app)
      .post(`/api/pagamentos/pedido/${pedidoId}/processar`)
      .set('Authorization', `Bearer ${tokenCliente}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('APROVADO');
    expect(res.body).toHaveProperty('transacaoId');
    expect(res.body).toHaveProperty('codigoAutorizacao');
    pagamentoStatus = res.body.status;

    // Verifica se status do pedido foi atualizado
    const pedRes = await request(app)
      .get(`/api/pedidos/${pedidoId}`)
      .set('Authorization', `Bearer ${tokenCliente}`);
    expect(pedRes.body.status).toBe('PAGO');
  });
});

// ─── T11: Pagamento duplo no mesmo pedido (409) ───────────────────────────
describe('T11 - Pagamento em pedido já pago (negativo)', () => {
  test('Deve retornar 409 ao tentar pagar pedido já processado', async () => {
    const res = await request(app)
      .post(`/api/pagamentos/pedido/${pedidoId}/processar`)
      .set('Authorization', `Bearer ${tokenCliente}`);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('CONFLITO_DADOS');
  });
});

// ─── T12: Atualização de status (cozinha) ────────────────────────────────
describe('T12 - Atualização de status por COZINHA (positivo)', () => {
  test('Deve atualizar de PAGO para EM_PREPARO', async () => {
    const res = await request(app)
      .patch(`/api/pedidos/${pedidoId}/status`)
      .set('Authorization', `Bearer ${tokenCozinha}`)
      .send({ status: 'EM_PREPARO' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('EM_PREPARO');
  });
});

// ─── T13: Transição de status inválida (409) ─────────────────────────────
describe('T13 - Transição de status inválida (negativo)', () => {
  test('Não deve permitir ir de EM_PREPARO para AGUARDANDO_PAGAMENTO', async () => {
    const res = await request(app)
      .patch(`/api/pedidos/${pedidoId}/status`)
      .set('Authorization', `Bearer ${tokenCozinha}`)
      .send({ status: 'AGUARDANDO_PAGAMENTO' });
    expect(res.statusCode).toBe(409);
  });
});

// ─── T14: Filtrar pedidos por canal (positivo) ───────────────────────────
describe('T14 - Filtrar pedidos por canalPedido (positivo)', () => {
  test('GET /pedidos?canalPedido=TOTEM deve retornar pedidos do totem', async () => {
    const res = await request(app)
      .get('/api/pedidos?canalPedido=TOTEM')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.every(p => p.canal_pedido === 'TOTEM')).toBe(true);
  });
});

// ─── T15: Estoque insuficiente (409) ─────────────────────────────────────
describe('T15 - Pedido com estoque insuficiente (negativo)', () => {
  test('Deve retornar 409 quando quantidade solicitada > estoque', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ unidadeId: 1, canalPedido: 'WEB', itens: [{ produtoId: 1, quantidade: 9999 }], formaPagamento: 'MOCK' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('ESTOQUE_INSUFICIENTE');
  });
});

// ─── T16: Fidelidade - saldo (positivo) ──────────────────────────────────
describe('T16 - Consultar saldo de fidelidade (positivo)', () => {
  test('Deve retornar saldo de pontos do cliente', async () => {
    const res = await request(app)
      .get('/api/fidelidade/saldo')
      .set('Authorization', `Bearer ${tokenCliente}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('pontos');
    expect(typeof res.body.pontos).toBe('number');
  });
});

// ─── T17: Auditoria acessível só por ADMIN ───────────────────────────────
describe('T17 - Log de auditoria acessível apenas por ADMIN (positivo)', () => {
  test('ADMIN deve receber 200 ao acessar auditoria', async () => {
    const res = await request(app)
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

// ─── T18: Cliente não acessa auditoria (403) ─────────────────────────────
describe('T18 - Cliente tentando acessar auditoria (negativo)', () => {
  test('CLIENTE deve receber 403 ao tentar acessar auditoria', async () => {
    const res = await request(app)
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenCliente}`);
    expect(res.statusCode).toBe(403);
  });
});
