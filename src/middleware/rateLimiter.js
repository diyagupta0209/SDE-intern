import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env.js';

function limiter({ windowMs, limit }) {
  if (getEnv().nodeEnv === 'test') {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        message: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
      },
    },
  });
}

export const authRateLimiter = () => limiter({ windowMs: 15 * 60 * 1000, limit: 30 });

export const categorizeRateLimiter = () => limiter({ windowMs: 60 * 1000, limit: 20 });
