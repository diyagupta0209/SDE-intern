import { Account } from '../models/Account.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { toCents } from '../utils/money.js';
import { pageMeta, presentAccount } from '../utils/presenters.js';
import { assertCanMutate, assertCanRead } from '../middleware/rbac.js';

export const createAccount = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const account = await Account.create({
    user: req.user.id,
    name: body.name,
    type: body.type,
    currency: body.currency || 'INR',
    institution: body.institution || '',
    allowNegative: body.allowNegative ?? body.type === 'credit',
    balanceCents: body.openingBalance === undefined ? 0 : toCents(body.openingBalance),
  });
  res.status(201).json({ success: true, data: presentAccount(account) });
});

export const listAccounts = asyncHandler(async (req, res) => {
  const { page, limit, userId, type, includeArchived } = req.validated.query;
  const filter = {};
  if (req.user.role === 'user') {
    if (userId && userId !== req.user.id) {
      throw new AppError('You do not have permission to view these accounts', 403, 'FORBIDDEN');
    }
    filter.user = req.user.id;
  } else if (userId) {
    filter.user = userId;
  }
  if (type) filter.type = type;
  if (includeArchived !== 'true') filter.isArchived = false;

  const [accounts, total] = await Promise.all([
    Account.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Account.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: accounts.map(presentAccount),
    meta: pageMeta({ page, limit, total }),
  });
});

export const getAccount = asyncHandler(async (req, res) => {
  const account = await Account.findById(req.validated.params.id);
  if (!account) throw new AppError('Account not found', 404, 'NOT_FOUND');
  assertCanRead(req.user, account.user);
  res.json({ success: true, data: presentAccount(account) });
});

export const updateAccount = asyncHandler(async (req, res) => {
  const account = await Account.findById(req.validated.params.id);
  if (!account) throw new AppError('Account not found', 404, 'NOT_FOUND');
  assertCanMutate(req.user, account.user);

  const { name, institution, allowNegative, isArchived } = req.validated.body;
  if (name !== undefined) account.name = name;
  if (institution !== undefined) account.institution = institution;
  if (allowNegative !== undefined) account.allowNegative = allowNegative;
  if (isArchived !== undefined) account.isArchived = isArchived;
  await account.save();
  res.json({ success: true, data: presentAccount(account) });
});

export const archiveAccount = asyncHandler(async (req, res) => {
  const account = await Account.findById(req.validated.params.id);
  if (!account) throw new AppError('Account not found', 404, 'NOT_FOUND');
  assertCanMutate(req.user, account.user);
  account.isArchived = true;
  await account.save();
  res.json({ success: true, data: presentAccount(account) });
});
