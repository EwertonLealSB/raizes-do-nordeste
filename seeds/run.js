// seeds/run.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('../src/infrastructure/database/connection');

async function runSeeds() {
  const db = getDb();

  // Verifica se já foi semeado
  const existing = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
  if (existing.count > 0) {
    console.log('⚠️  Seed já executado anteriormente. Pulando...');
    return;
  }

  const senhaHash = bcrypt.hashSync('Senha@123', 10);

  // Usuários
  const insertUser = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, perfil, lgpd_consentimento, ativo)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const adminId = insertUser.run('Admin Sistema', 'admin@raizesnordeste.com', senhaHash, 'ADMIN', 1).lastInsertRowid;
  const gerenteId = insertUser.run('Gerente João', 'gerente@raizesnordeste.com', senhaHash, 'GERENTE', 1).lastInsertRowid;
  insertUser.run('Atendente Maria', 'atendente@raizesnordeste.com', senhaHash, 'ATENDENTE', 1);
  insertUser.run('Cozinha Pedro', 'cozinha@raizesnordeste.com', senhaHash, 'COZINHA', 1);
  const clienteId = insertUser.run('Cliente Ana Silva', 'cliente@email.com', senhaHash, 'CLIENTE', 1).lastInsertRowid;

  // Unidades
  const insertUnidade = db.prepare(`
    INSERT INTO unidades (nome, endereco, cidade, estado) VALUES (?, ?, ?, ?)
  `);
  const u1 = insertUnidade.run('Raízes Fortaleza Centro', 'Rua Barão do Rio Branco, 100', 'Fortaleza', 'CE').lastInsertRowid;
  const u2 = insertUnidade.run('Raízes Recife Boa Viagem', 'Av. Boa Viagem, 500', 'Recife', 'PE').lastInsertRowid;
  const u3 = insertUnidade.run('Raízes Salvador Pelourinho', 'Largo do Pelourinho, 10', 'Salvador', 'BA').lastInsertRowid;

  // Produtos
  const insertProduto = db.prepare(`
    INSERT INTO produtos (nome, descricao, preco, categoria) VALUES (?, ?, ?, ?)
  `);
  const p1 = insertProduto.run('Tapioca Nordestina', 'Tapioca recheada com carne de sol e queijo coalho', 18.90, 'Lanches').lastInsertRowid;
  const p2 = insertProduto.run('Baião de Dois', 'Feijão-verde com arroz, queijo e bacon', 29.90, 'Pratos').lastInsertRowid;
  const p3 = insertProduto.run('Caldo de Cana', 'Suco natural de cana gelado 500ml', 8.90, 'Bebidas').lastInsertRowid;
  const p4 = insertProduto.run('Carne de Sol Grelhada', 'Carne de sol com manteiga de garrafa e macaxeira', 39.90, 'Pratos').lastInsertRowid;
  const p5 = insertProduto.run('Cocada Branca', 'Cocada artesanal nordestina', 6.00, 'Sobremesas').lastInsertRowid;
  const p6 = insertProduto.run('Suco de Umbu', 'Suco natural de umbu 300ml', 9.90, 'Bebidas').lastInsertRowid;

  // Estoques por Unidade
  const insertEstoque = db.prepare(`
    INSERT INTO estoques (unidade_id, produto_id, quantidade) VALUES (?, ?, ?)
  `);
  for (const uid of [u1, u2, u3]) {
    insertEstoque.run(uid, p1, 50);
    insertEstoque.run(uid, p2, 30);
    insertEstoque.run(uid, p3, 100);
    insertEstoque.run(uid, p4, 20);
    insertEstoque.run(uid, p5, 80);
    insertEstoque.run(uid, p6, 60);
  }

  // Fidelidade para o cliente
  db.prepare(`INSERT INTO fidelidade (cliente_id, pontos, consentimento) VALUES (?, ?, 1)`).run(clienteId, 150);

  console.log('✅ Seeds executados com sucesso!');
  console.log('\n📋 Credenciais de acesso:');
  console.log('  Admin:     admin@raizesnordeste.com    | Senha@123');
  console.log('  Gerente:   gerente@raizesnordeste.com  | Senha@123');
  console.log('  Atendente: atendente@raizesnordeste.com| Senha@123');
  console.log('  Cozinha:   cozinha@raizesnordeste.com  | Senha@123');
  console.log('  Cliente:   cliente@email.com           | Senha@123');
}

runSeeds().catch(console.error);
