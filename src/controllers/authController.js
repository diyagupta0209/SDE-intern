import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  issueAuthTokens,
  publicUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../services/tokenService.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validated.body;
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('A record with that email already exists', 409, 'CONFLICT');

  const user = await User.create({ name, email, password });
  const tokens = await issueAuthTokens(user);
  res.status(201).json({
    success: true,
    data: { user: publicUser(user), ...tokens },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const matches = await user.comparePassword(password);
  if (!matches) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  const tokens = await issueAuthTokens(user);
  res.json({ success: true, data: { user: publicUser(user), ...tokens } });
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, tokens } = await rotateRefreshToken(req.validated.body.refreshToken);
  res.json({ success: true, data: { user: publicUser(user), ...tokens } });
});

export const logout = asyncHandler(async (req, res) => {
  await revokeRefreshToken(req.user.id, req.validated.body.refreshToken);
  res.status(204).send();
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, data: publicUser(user) });
});
