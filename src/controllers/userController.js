import { ROLES } from '../constants/roles.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/regex.js';
import { pageMeta } from '../utils/presenters.js';
import { publicUser } from '../services/tokenService.js';

export const createUser = asyncHandler(async (req, res) => {
  const user = await User.create({
    name: req.validated.body.name,
    email: req.validated.body.email,
    password: req.validated.body.password,
    role: req.validated.body.role || ROLES.USER,
  });
  res.status(201).json({ success: true, data: publicUser(user) });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, role, q } = req.validated.query;
  const filter = {};
  if (role) filter.role = role;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: users.map(publicUser),
    meta: pageMeta({ page, limit, total }),
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.validated.params.id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  const isSelf = req.user.id === user.id;
  const canRead = isSelf || req.user.role === ROLES.ADMIN || req.user.role === ROLES.ANALYST;
  if (!canRead) throw new AppError('You do not have permission to view this resource', 403, 'FORBIDDEN');
  res.json({ success: true, data: publicUser(user) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.validated.params.id).select('+password');
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const isSelf = req.user.id === user.id;
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isSelf && !isAdmin) {
    throw new AppError('You do not have permission to modify this resource', 403, 'FORBIDDEN');
  }

  const { name, currentPassword, newPassword, role, isActive } = req.validated.body;
  if ((role !== undefined || isActive !== undefined) && !isAdmin) {
    throw new AppError('Only an administrator can change role or account status', 403, 'FORBIDDEN');
  }

  if (newPassword) {
    if (!isAdmin || isSelf) {
      if (!currentPassword) {
        throw new AppError('Current password is required', 400, 'VALIDATION_ERROR');
      }
      const matches = await user.comparePassword(currentPassword);
      if (!matches) throw new AppError('Current password is incorrect', 400, 'VALIDATION_ERROR');
    }
    user.password = newPassword;
    user.refreshTokens = [];
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }

  if (name) user.name = name;
  if (isAdmin && role) user.role = role;
  if (isAdmin && isActive !== undefined) {
    user.isActive = isActive;
    if (!isActive) user.refreshTokens = [];
  }

  await user.save();
  res.json({ success: true, data: publicUser(user) });
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.validated.params.id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  user.isActive = false;
  user.refreshTokens = [];
  await user.save();
  res.json({ success: true, data: publicUser(user) });
});
