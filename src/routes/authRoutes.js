import { Router } from 'express';
import { login, logout, me, refresh, register } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, refreshSchema, registerSchema } from '../validators/authValidators.js';

export const authRouter = Router();
const limit = authRateLimiter();

authRouter.post('/register', limit, validate(registerSchema), register);
authRouter.post('/login', limit, validate(loginSchema), login);
authRouter.post('/refresh', limit, validate(refreshSchema), refresh);
authRouter.post('/logout', authenticate, validate(refreshSchema), logout);
authRouter.get('/me', authenticate, me);
