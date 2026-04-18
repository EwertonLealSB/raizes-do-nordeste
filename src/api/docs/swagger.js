// src/api/docs/swagger.js
const swaggerDoc = {
  openapi: '3.0.0',
  info: {
    title: 'API Raízes do Nordeste',
    version: '1.0.0',
    description: 'API Back-end para a rede de lanchonetes Raízes do Nordeste. Projeto Multidisciplinar UNINTER 2026.',
    contact: { name: 'Suporte Técnico', email: 'tech@raizesnordeste.com' },
  },
  servers: [{ url: 'http://localhost:3000/api', description: 'Servidor local de desenvolvimento' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErroResposta: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'NOME_DO_ERRO' },
          message: { type: 'string', example: 'Mensagem legível do erro.' },
          details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, issue: { type: 'string' } } } },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login do usuário',
        description: 'Autentica o usuário e retorna um token JWT.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'senha'],
                properties: {
                  email: { type: 'string', example: 'cliente@email.com' },
                  senha: { type: 'string', example: 'Senha@123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login realizado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    tokenType: { type: 'string', example: 'Bearer' },
                    expiresIn: { type: 'integer', example: 3600 },
                    user: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' }, email: { type: 'string' }, perfil: { type: 'string' } } },
                  },
                },
              },
            },
          },
          401: { description: 'Credenciais inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroResposta' } } } },
          422: { description: 'Campos obrigatórios ausentes', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroResposta' } } } },
        },
      },
    },
    '/auth/cadastro': {
      post: {
        tags: ['Auth'],
        summary: 'Cadastro de novo usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'email', 'senha'],
                properties: {
                  nome: { type: 'string', example: 'Maria da Silva' },
                  email: { type: 'string', example: 'maria@email.com' },
                  senha: { type: 'string', example: 'Senha@123' },
                  perfil: { type: 'string', enum: ['CLIENTE', 'ATENDENTE', 'COZINHA', 'GERENTE', 'ADMIN'], default: 'CLIENTE' },
                  lgpdConsentimento: { type: 'boolean', example: true, description: 'Consentimento LGPD para programa de fidelidade' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuário criado' },
          409: { description: 'E-mail já cadastrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroResposta' } } } },
        },
      },
    },
    '/auth/perfil': {
      get: {
        tags: ['Auth'],
        summary: 'Retorna dados do usuário autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Dados do perfil (sem senha_hash)' },
          401: { description: 'Não autenticado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroResposta' } } } },
        },
      },
    },
    '/unidades': {
      get: {
        tags: ['Unidades'],
        summary: 'Lista todas as unidades ativas da rede',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de unidades' }, 401: { description: 'Não autenticado' } },
      },
      post: {
        tags: ['Unidades'],
        summary: 'Cria uma nova unidade (ADMIN/GERENTE)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'endereco', 'cidade', 'estado'],
                properties: {
                  nome: { type: 'string', example: 'Raízes Natal' },
                  endereco: { type: 'string', example: 'Av. Prudente de Morais, 200' },
                  cidade: { type: 'string', example: 'Natal' },
                  estado: { type: 'string', example: 'RN' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Unidade criada' }, 403: { description: 'Sem permissão' } },
      },
    },
    '/produtos': {
      get: {
        tags: ['Produtos'],
        summary: 'Lista produtos do cardápio com paginação',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
          { in: 'query', name: 'categoria', schema: { type: 'string', example: 'Lanches' } },
        ],
        responses: { 200: { description: 'Lista paginada de produtos' } },
      },
      post: {
        tags: ['Produtos'],
        summary: 'Cria produto no cardápio (ADMIN/GERENTE)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'preco', 'categoria'],
                properties: {
                  nome: { type: 'string', example: 'Buchada de Bode' },
                  descricao: { type: 'string', example: 'Prato típico nordestino' },
                  preco: { type: 'number', example: 35.90 },
                  categoria: { type: 'string', example: 'Pratos' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Produto criado' } },
      },
    },
    '/produtos/{id}': {
      get: {
        tags: ['Produtos'],
        summary: 'Busca produto por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Produto encontrado' }, 404: { description: 'Não encontrado' } },
      },
      patch: {
        tags: ['Produtos'],
        summary: 'Atualiza produto (ADMIN/GERENTE)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { nome: { type: 'string' }, preco: { type: 'number' }, categoria: { type: 'string' }, ativo: { type: 'integer' } } } } } },
        responses: { 200: { description: 'Produto atualizado' } },
      },
      delete: {
        tags: ['Produtos'],
        summary: 'Desativa produto (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Produto desativado' } },
      },
    },
    '/estoque/{unidadeId}': {
      get: {
        tags: ['Estoque'],
        summary: 'Consulta estoque de uma unidade',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'unidadeId', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Estoque da unidade' } },
      },
    },
    '/estoque/{unidadeId}/movimentar': {
      post: {
        tags: ['Estoque'],
        summary: 'Movimenta estoque de uma unidade (ENTRADA ou SAIDA)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'unidadeId', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['produtoId', 'tipo', 'quantidade'],
                properties: {
                  produtoId: { type: 'integer', example: 1 },
                  tipo: { type: 'string', enum: ['ENTRADA', 'SAIDA'] },
                  quantidade: { type: 'integer', example: 20 },
                  observacao: { type: 'string', example: 'Reposição semanal' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Estoque movimentado' },
          409: { description: 'Estoque insuficiente para SAIDA', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroResposta' } } } },
        },
      },
    },
    '/pedidos': {
      get: {
        tags: ['Pedidos'],
        summary: 'Lista pedidos com filtros',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
          { in: 'query', name: 'canalPedido', schema: { type: 'string', enum: ['APP', 'TOTEM', 'BALCAO', 'PICKUP', 'WEB'] } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['AGUARDANDO_PAGAMENTO', 'PAGO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'] } },
          { in: 'query', name: 'unidadeId', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Lista paginada de pedidos' } },
      },
      post: {
        tags: ['Pedidos'],
        summary: 'Cria um novo pedido (fluxo crítico)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['unidadeId', 'canalPedido', 'itens', 'formaPagamento'],
                properties: {
                  unidadeId: { type: 'integer', example: 1 },
                  canalPedido: { type: 'string', enum: ['APP', 'TOTEM', 'BALCAO', 'PICKUP', 'WEB'], example: 'TOTEM' },
                  itens: { type: 'array', items: { type: 'object', properties: { produtoId: { type: 'integer' }, quantidade: { type: 'integer' } } }, example: [{ produtoId: 1, quantidade: 2 }] },
                  formaPagamento: { type: 'string', enum: ['MOCK', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'], example: 'MOCK' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Pedido criado com sucesso' },
          404: { description: 'Unidade ou produto não encontrado' },
          409: { description: 'Estoque insuficiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroResposta' } } } },
          422: { description: 'canalPedido inválido ou campos ausentes', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroResposta' } } } },
        },
      },
    },
    '/pedidos/{id}': {
      get: {
        tags: ['Pedidos'],
        summary: 'Busca pedido por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Pedido com itens' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/pedidos/{id}/status': {
      patch: {
        tags: ['Pedidos'],
        summary: 'Atualiza status do pedido (cozinha → pronto → entregue)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string', enum: ['PAGO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'] } },
              },
            },
          },
        },
        responses: { 200: { description: 'Status atualizado' }, 409: { description: 'Transição inválida' } },
      },
    },
    '/pagamentos/pedido/{pedidoId}/processar': {
      post: {
        tags: ['Pagamentos'],
        summary: 'Processa pagamento via mock (simula gateway externo)',
        description: 'Envia o pedido ao gateway mock e registra o resultado. Se aprovado, atualiza status do pedido para PAGO e acumula pontos de fidelidade.',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'pedidoId', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'Resultado do pagamento (APROVADO ou RECUSADO)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pagamentoId: { type: 'integer' },
                    pedidoId: { type: 'integer' },
                    status: { type: 'string', enum: ['APROVADO', 'RECUSADO'] },
                    valor: { type: 'number' },
                    transacaoId: { type: 'string' },
                    mensagem: { type: 'string' },
                    codigoAutorizacao: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          409: { description: 'Pedido não está aguardando pagamento' },
        },
      },
    },
    '/pagamentos/pedido/{pedidoId}': {
      get: {
        tags: ['Pagamentos'],
        summary: 'Lista pagamentos de um pedido',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'pedidoId', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Lista de pagamentos' } },
      },
    },
    '/fidelidade/saldo': {
      get: {
        tags: ['Fidelidade'],
        summary: 'Consulta saldo de pontos do cliente autenticado',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Saldo de pontos' } },
      },
    },
    '/fidelidade/resgatar': {
      post: {
        tags: ['Fidelidade'],
        summary: 'Resgata pontos de fidelidade (mínimo 50)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['pontos'], properties: { pontos: { type: 'integer', minimum: 50, example: 100 } } } } },
        },
        responses: { 200: { description: 'Pontos resgatados' }, 409: { description: 'Saldo insuficiente' } },
      },
    },
    '/fidelidade/consentimento': {
      patch: {
        tags: ['Fidelidade'],
        summary: 'Atualiza consentimento LGPD para programa de fidelidade',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { consentimento: { type: 'boolean', example: true } } } } },
        },
        responses: { 200: { description: 'Consentimento atualizado' } },
      },
    },
    '/fidelidade/historico': {
      get: {
        tags: ['Fidelidade'],
        summary: 'Histórico de acúmulo/resgate de pontos',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Histórico de pontos' } },
      },
    },
    '/auditoria': {
      get: {
        tags: ['Auditoria'],
        summary: 'Log de auditoria de ações sensíveis (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Log de auditoria' }, 403: { description: 'Sem permissão' } },
      },
    },
  },
};

module.exports = swaggerDoc;
