import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

export function formatZodError(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    });
    if (!parsed.success) {
      next(new AppError('Request validation failed', 400, 'VALIDATION_ERROR', formatZodError(parsed.error)));
      return;
    }
    req.validated = parsed.data;
    next();
  };
}

export function isZodError(error) {
  return error instanceof ZodError;
}
