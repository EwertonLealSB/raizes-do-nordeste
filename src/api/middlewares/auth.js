// src/api/middlewares/auth.js
const jwt = require('jsonwebtoken');
const { NaoAutenticadoError, SemPermissaoError } = require('../../domain/errors');

function autenticar(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new NaoAutenticadoError();
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded; // { id, perfil }
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new NaoAutenticadoError());
    }
    next(err);
  }
}

function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) return next(new NaoAutenticadoError());
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return next(new SemPermissaoError());
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
