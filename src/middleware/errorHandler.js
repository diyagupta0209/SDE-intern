import { AppError } from '../utils/AppError.js';
import { isZodError, formatZodError } from './validate.js';

function normalize(err) {
  if (err instanceof AppError) return err;
  if (isZodError(err)) {
    return new AppError('Request validation failed', 400, 'VALIDATION_ERROR', formatZodError(err));
  }
  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors).map((item) => ({
      path: item.path,
      message: item.message,
    }));
    return new AppError('Request validation failed', 400, 'VALIDATION_ERROR', details);
  }
  if (err?.name === 'CastError') {
    return new AppError(`Invalid ${err.path}`, 400, 'VALIDATION_ERROR');
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    return new AppError(`A record with that ${field} already exists`, 409, 'CONFLICT');
  }
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new AppError('Malformed JSON body', 400, 'INVALID_JSON');
  }
  return err;
}

export function errorHandler(err, req, res, _next) {
  const normalized = normalize(err);
  const isOperational = normalized instanceof AppError;
  const statusCode = isOperational ? normalized.statusCode : 500;
  const code = isOperational ? normalized.code : 'INTERNAL_ERROR';
  const message = isOperational ? normalized.message : 'Something went wrong';

  if (!isOperational) {
    console.error(err);
  }

  const body = {
    success: false,
    error: {
      message,
      code,
      requestId: req.id,
    },
  };
  if (isOperational && normalized.details) {
    body.error.details = normalized.details;
  }
  if (!isOperational && process.env.NODE_ENV !== 'production' && err?.stack) {
    body.error.stack = err.stack;
  }
  res.status(statusCode).json(body);
}
