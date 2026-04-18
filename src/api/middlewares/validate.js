// src/api/middlewares/validate.js
const { ValidacaoError } = require('../../domain/errors');

/**
 * Valida campos obrigatórios no body da requisição.
 * @param {string[]} campos - nomes dos campos obrigatórios
 */
function requerer(...campos) {
  return (req, res, next) => {
    const ausentes = campos.filter(c => {
      const val = req.body[c];
      return val === undefined || val === null || val === '';
    });
    if (ausentes.length > 0) {
      const details = ausentes.map(c => ({ field: c, issue: 'Campo obrigatório.' }));
      return next(new ValidacaoError('Um ou mais campos obrigatórios estão ausentes.', details));
    }
    next();
  };
}

module.exports = { requerer };
