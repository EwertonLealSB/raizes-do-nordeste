// migrations/run.js
require('dotenv').config();
const { getDb } = require('../src/infrastructure/database/connection');

function runMigrations() {
  const db = getDb();

  db.exec(`
    -- Tabela de Usuários
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK(perfil IN ('ADMIN','GERENTE','ATENDENTE','COZINHA','CLIENTE')),
      lgpd_consentimento INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tabela de Unidades da Rede
    CREATE TABLE IF NOT EXISTS unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      endereco TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL,
      ativa INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tabela de Produtos (cardápio global)
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL NOT NULL CHECK(preco > 0),
      categoria TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Estoque por Unidade
    CREATE TABLE IF NOT EXISTS estoques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unidade_id INTEGER NOT NULL REFERENCES unidades(id),
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      quantidade INTEGER NOT NULL DEFAULT 0 CHECK(quantidade >= 0),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(unidade_id, produto_id)
    );

    -- Movimentações de Estoque (auditoria)
    CREATE TABLE IF NOT EXISTS movimentos_estoque (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unidade_id INTEGER NOT NULL REFERENCES unidades(id),
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('ENTRADA','SAIDA')),
      quantidade INTEGER NOT NULL,
      usuario_id INTEGER REFERENCES usuarios(id),
      observacao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tabela de Pedidos
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER REFERENCES usuarios(id),
      unidade_id INTEGER NOT NULL REFERENCES unidades(id),
      canal_pedido TEXT NOT NULL CHECK(canal_pedido IN ('APP','TOTEM','BALCAO','PICKUP','WEB')),
      status TEXT NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO'
        CHECK(status IN ('AGUARDANDO_PAGAMENTO','PAGO','EM_PREPARO','PRONTO','ENTREGUE','CANCELADO')),
      forma_pagamento TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Itens do Pedido
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      quantidade INTEGER NOT NULL CHECK(quantidade > 0),
      preco_unitario REAL NOT NULL
    );

    -- Pagamentos (mock)
    CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      forma TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDENTE','APROVADO','RECUSADO')),
      valor REAL NOT NULL,
      payload_mock TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Programa de Fidelidade
    CREATE TABLE IF NOT EXISTS fidelidade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id),
      pontos INTEGER NOT NULL DEFAULT 0,
      consentimento INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Histórico de Fidelidade
    CREATE TABLE IF NOT EXISTS historico_fidelidade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('ACUMULO','RESGATE')),
      pontos INTEGER NOT NULL,
      descricao TEXT,
      pedido_id INTEGER REFERENCES pedidos(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Log de auditoria (ações sensíveis - LGPD)
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      acao TEXT NOT NULL,
      recurso TEXT NOT NULL,
      recurso_id TEXT,
      detalhes TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ Migrations executadas com sucesso.');
}

runMigrations();
