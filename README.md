# 🌵 Raízes do Nordeste — API Back-end

Projeto Multidisciplinar UNINTER 2026 | Trilha Back-End  
Rede de lanchonetes **Raízes do Nordeste** — API REST com autenticação JWT, controle de estoque por unidade, gestão de pedidos multicanal, pagamento mock e programa de fidelidade.

---

## 📋 Requisitos

| Tecnologia | Versão mínima |
|---|---|
| Node.js | 18.x ou superior |
| npm | 9.x ou superior |
| SQLite | Embutido (via better-sqlite3, sem instalação separada) |

> Não é necessário instalar banco de dados externo. O SQLite é criado automaticamente no diretório do projeto.

---

## ⚡ Início Rápido

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/raizes-do-nordeste-api.git
cd raizes-do-nordeste-api
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

O `.env` padrão já funciona para desenvolvimento local. Edite se necessário:

```env
PORT=3000
JWT_SECRET=raizes_nordeste_secret_key_2026
JWT_EXPIRES_IN=3600
DB_PATH=./database.sqlite
PAYMENT_MOCK_APPROVAL_RATE=0.8   # 80% de aprovação no gateway mock
```

### 4. Crie o banco e execute as migrations

```bash
node migrations/run.js
```

### 5. Popule com dados iniciais (seed)

```bash
node seeds/run.js
```

**Credenciais criadas pelo seed:**

| Perfil | E-mail | Senha |
|---|---|---|
| ADMIN | admin@raizesnordeste.com | Senha@123 |
| GERENTE | gerente@raizesnordeste.com | Senha@123 |
| ATENDENTE | atendente@raizesnordeste.com | Senha@123 |
| COZINHA | cozinha@raizesnordeste.com | Senha@123 |
| CLIENTE | cliente@email.com | Senha@123 |

### 6. Inicie a API

```bash
npm start
# ou em modo desenvolvimento (com auto-reload):
npm run dev
```

---

## 📚 Documentação

Após iniciar o servidor, acesse:

- **Swagger/OpenAPI:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Health check:** [http://localhost:3000/health](http://localhost:3000/health)

---

## 🧪 Testes automatizados

```bash
npm test
```

Os testes cobrem 18 cenários (positivos e negativos):
- Autenticação (login válido, credenciais inválidas, token ausente)
- Autorização por perfis/roles (401, 403)
- Criação de pedidos com `canalPedido` (TOTEM, APP, WEB...)
- Pagamento mock (aprovado e recusado)
- Estoque insuficiente (409)
- Transições de status inválidas (409)
- Fidelidade e auditoria

---

## 🔁 Fluxo principal (Fluxo A — MVP entregue)

```
CLIENTE faz login → Obtém JWT
    ↓
POST /api/pedidos  (com canalPedido obrigatório)
    ↓ valida estoque, baixa estoque, calcula total
    → status: AGUARDANDO_PAGAMENTO
    ↓
POST /api/pagamentos/pedido/{id}/processar
    ↓ chama gateway mock
    → APROVADO: status → PAGO + pontos de fidelidade acumulados
    → RECUSADO: status permanece AGUARDANDO_PAGAMENTO
    ↓
PATCH /api/pedidos/{id}/status  { "status": "EM_PREPARO" }  (COZINHA)
    ↓
PATCH /api/pedidos/{id}/status  { "status": "PRONTO" }
    ↓
PATCH /api/pedidos/{id}/status  { "status": "ENTREGUE" }
```

---

## 🗂️ Estrutura do Projeto

```
raizes-do-nordeste/
├── src/
│   ├── domain/
│   │   ├── entities/       # Entidades e regras de negócio (Pedido, Produto, Estoque...)
│   │   ├── enums/          # Enumerações: CanalPedido, StatusPedido, PerfilUsuario...
│   │   └── errors/         # Erros de domínio tipados (AppError, EstoqueInsuficienteError...)
│   ├── application/
│   │   └── usecases/       # Casos de uso: AuthUseCases, PedidoUseCases, PagamentoUseCases...
│   ├── infrastructure/
│   │   ├── database/       # Conexão SQLite (better-sqlite3)
│   │   ├── repositories/   # Acesso ao banco: UsuarioRepository, PedidoRepository...
│   │   └── mock/           # Gateway de pagamento simulado
│   └── api/
│       ├── controllers/    # Controladores HTTP
│       ├── middlewares/    # auth.js, errorHandler.js, validate.js
│       ├── routes/         # Definição das rotas
│       └── docs/           # Swagger/OpenAPI
├── migrations/run.js       # DDL: criação de tabelas
├── seeds/run.js            # Dados iniciais
├── tests/api.test.js       # Testes automatizados (Jest + Supertest)
├── .env.example
└── package.json
```

---

## 🔐 Segurança e LGPD

- **Senhas:** armazenadas com hash `bcrypt` (salt 10), nunca expostas em responses
- **Autenticação:** JWT Bearer Token em todas as rotas protegidas
- **Autorização:** perfis ADMIN / GERENTE / ATENDENTE / COZINHA / CLIENTE
- **LGPD:** consentimento explícito registrado para programa de fidelidade (`lgpd_consentimento`); dados pessoais coletados apenas para autenticação e pedidos; endpoint de atualização de consentimento disponível
- **Auditoria:** tabela `audit_log` registra ações sensíveis: login, criação/cancelamento de pedido, mudança de status, movimentação de estoque, pagamentos

---

## 🌐 Endpoints principais

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| POST | /api/auth/login | público | Login |
| POST | /api/auth/cadastro | público | Cadastro |
| GET | /api/unidades | todos | Lista unidades |
| GET | /api/produtos | todos | Cardápio paginado |
| GET | /api/estoque/:unidadeId | todos | Estoque por unidade |
| POST | /api/estoque/:unidadeId/movimentar | ADMIN/GERENTE/ATENDENTE | Movimentação |
| POST | /api/pedidos | todos | Criar pedido (canalPedido obrigatório) |
| GET | /api/pedidos?canalPedido=TOTEM | todos | Filtrar por canal |
| PATCH | /api/pedidos/:id/status | todos exceto CLIENTE | Atualizar status |
| POST | /api/pagamentos/pedido/:id/processar | todos | Pagamento mock |
| GET | /api/fidelidade/saldo | CLIENTE | Saldo de pontos |
| POST | /api/fidelidade/resgatar | CLIENTE | Resgatar pontos |
| GET | /api/auditoria | ADMIN | Log de auditoria |

---

## 📦 Coleção Postman/Insomnia

O arquivo `raizes_nordeste_collection.json` está na raiz do repositório.

**Ordem sugerida de execução:**
1. Auth / Login Admin
2. Auth / Login Cliente
3. Unidades / Listar
4. Produtos / Listar
5. Pedidos / Criar (TOTEM)
6. Pagamentos / Processar
7. Pedidos / Atualizar Status (EM_PREPARO)
8. Fidelidade / Saldo
9. Erros / Sem token (401)
10. Erros / Sem permissão (403)

---

## 🔗 Links

- **Swagger local:** http://localhost:3000/api-docs
- **Health:** http://localhost:3000/health

---

## 👤 Autor

**Ewerton Leal de Souza Brito**  
RU: 4287537  
Análise e Desenvolvimento de Sistemas (ADS)
