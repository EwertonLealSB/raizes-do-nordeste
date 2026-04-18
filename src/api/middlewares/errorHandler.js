// src/api/middlewares/errorHandler.js
const { AppError } = require('../../domain/errors');

function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl;

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.error,
      message: err.message,
      details: err.details || [],
      timestamp,
      path,
    });
  }

  // Erro não tratado
  console.error('[UNHANDLED ERROR]', err);
  return res.status(500).json({
    error: 'ERRO_INTERNO',
    message: 'Ocorreu um erro interno no servidor.',
    details: [],
    timestamp,
    path,
  });
}

module.exports = { errorHandler };
