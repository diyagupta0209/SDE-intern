import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { durationMs } from '../utils/duration.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const MAX_REFRESH_TOKENS = 5;

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user) {
  const env = getEnv();
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, tv: user.tokenVersion || 0 },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export async function issueAuthTokens(user) {
  const env = getEnv();
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + durationMs(env.jwtRefreshExpiresIn));
  user.refreshTokens.push({ tokenHash: hashToken(refreshToken), expiresAt });
  if (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
    user.refreshTokens.splice(0, user.refreshTokens.length - MAX_REFRESH_TOKENS);
  }
  await user.save();
  return {
    accessToken: signAccessToken(user),
    refreshToken,
    expiresIn: env.jwtExpiresIn,
  };
}

export async function rotateRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash }).select('+password');
  if (!user || !user.isActive) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }
  const stored = user.refreshTokens.find((entry) => entry.tokenHash === tokenHash);
  user.refreshTokens = user.refreshTokens.filter((entry) => entry.tokenHash !== tokenHash);
  if (!stored || stored.expiresAt.getTime() <= Date.now()) {
    await user.save();
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
  }
  const tokens = await issueAuthTokens(user);
  return { user, tokens };
}

export async function revokeRefreshToken(userId, refreshToken) {
  const tokenHash = hashToken(refreshToken);
  await User.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenHash } } },
  );
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
