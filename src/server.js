// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const routes = require('./api/routes');
const { errorHandler } = require('./api/middlewares/errorHandler');
const swaggerDoc = require('./api/docs/swagger');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globais ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Middleware de log de requisições (simples, sem biblioteca externa)
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    const duracao = Date.now() - inicio;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duracao}ms)`);
  });
  next();
});

// ─── Swagger UI ───────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
  customSiteTitle: 'Raízes do Nordeste API',
}));

// ─── Rotas da API ─────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'raizes-do-nordeste-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── Rota não encontrada ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'ROTA_NAO_ENCONTRADA',
    message: `Rota ${req.method} ${req.originalUrl} não existe.`,
    details: [],
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
});

// ─── Handler global de erros ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Inicialização ───────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('🌵  Raízes do Nordeste API');
    console.log(`🚀  Servidor rodando em: http://localhost:${PORT}`);
    console.log(`📚  Swagger/OpenAPI:     http://localhost:${PORT}/api-docs`);
    console.log(`❤️   Health check:        http://localhost:${PORT}/health`);
    console.log('');
  });
}

module.exports = app;
