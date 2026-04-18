// src/domain/errors/index.js

class AppError extends Error {
  constructor(error, message, statusCode = 400, details = []) {
    super(message);
    this.error = error;
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class NaoEncontradoError extends AppError {
  constructor(recurso, id) {
    super('NAO_ENCONTRADO', `${recurso} não encontrado(a)${id ? `: ${id}` : ''}.`, 404);
  }
}

class NaoAutenticadoError extends AppError {
  constructor() {
    super('NAO_AUTENTICADO', 'Token de autenticação ausente ou inválido.', 401);
  }
}

class SemPermissaoError extends AppError {
  constructor() {
    super('SEM_PERMISSAO', 'Você não tem permissão para acessar este recurso.', 403);
  }
}

class EstoqueInsuficienteError extends AppError {
  constructor(details = []) {
    super('ESTOQUE_INSUFICIENTE', 'Não há quantidade suficiente para um ou mais itens.', 409, details);
  }
}

class CredenciaisInvalidasError extends AppError {
  constructor() {
    super('CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.', 401);
  }
}

class ConflitoDadosError extends AppError {
  constructor(message) {
    super('CONFLITO_DADOS', message, 409);
  }
}

class ValidacaoError extends AppError {
  constructor(message, details = []) {
    super('ERRO_VALIDACAO', message, 422, details);
  }
}

module.exports = {
  AppError,
  NaoEncontradoError,
  NaoAutenticadoError,
  SemPermissaoError,
  EstoqueInsuficienteError,
  CredenciaisInvalidasError,
  ConflitoDadosError,
  ValidacaoError,
};
