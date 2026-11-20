import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  let payload;
  try {
    payload = jwt.verify(token, getEnv().jwtSecret);
  } catch {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || (payload.tv ?? 0) !== (user.tokenVersion || 0)) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  req.user = {
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  next();
});
