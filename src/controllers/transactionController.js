import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fromCents, toCents } from '../utils/money.js';
import { escapeRegex } from '../utils/regex.js';
import { pageMeta, presentTransaction } from '../utils/presenters.js';
import { assertCanRead } from '../middleware/rbac.js';
import { categorizeTransaction } from '../services/llmCategorizer.js';
import {
  createTransaction,
  recategorizeTransaction,
  removeTransaction,
  updateTransaction,
} from '../services/transactionService.js';

const SORT_FIELDS = {
  date: 'occurredAt',
  amount: 'amountCents',
  createdAt: 'createdAt',
};

function ownedFilter(actor, query) {
  const filter = {};
  if (actor.role === 'user') {
    if (query.userId && query.userId !== actor.id) {
      throw new AppError('You do not have permission to view these transactions', 403, 'FORBIDDEN');
    }
    filter.user = actor.id;
  } else if (query.userId) {
    filter.user = query.userId;
  }
  if (query.accountId) filter.account = query.accountId;
  if (query.categoryId) filter.category = query.categoryId;
  if (query.type) filter.type = query.type;
  if (query.from || query.to) {
    filter.occurredAt = {};
    if (query.from) filter.occurredAt.$gte = query.from;
    if (query.to) filter.occurredAt.$lte = query.to;
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ description: pattern }, { merchant: pattern }];
  }
  return filter;
}

function sortFromQuery(sort) {
  const descending = sort.startsWith('-');
  const field = SORT_FIELDS[sort.replace(/^-/, '')];
  return { [field]: descending ? -1 : 1 };
}

function amountCents(body) {
  return body.amount === undefined ? undefined : toCents(body.amount);
}

export const create = asyncHandler(async (req, res) => {
  const categories = await Category.find();
  const body = req.validated.body;
  const transaction = await createTransaction({
    ownerId: req.user.id,
    categories,
    input: {
      ...body,
      amountCents: toCents(body.amount),
    },
  });
  res.status(201).json({ success: true, data: presentTransaction(transaction) });
});

export const list = asyncHandler(async (req, res) => {
  const query = req.validated.query;
  const filter = ownedFilter(req.user, query);
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort(sortFromQuery(query.sort))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('account', 'name currency type')
      .lean(),
    Transaction.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items.map(presentTransaction),
    meta: pageMeta({ page: query.page, limit: query.limit, total }),
  });
});

export const summary = asyncHandler(async (req, res) => {
  const filter = ownedFilter(req.user, req.validated.query);
  const match = { ...filter };
  for (const field of ['user', 'account', 'category']) {
    if (match[field]) match[field] = new mongoose.Types.ObjectId(match[field]);
  }
  const rows = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { categoryName: '$categoryName', type: '$type' },
        totalCents: { $sum: '$amountCents' },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalCents: -1 } },
  ]);
  res.json({
    success: true,
    data: rows.map((row) => ({
      category: row._id.categoryName,
      type: row._id.type,
      total: fromCents(row.totalCents),
      count: row.count,
    })),
  });
});

export const preview = asyncHandler(async (req, res) => {
  const categories = await Category.find();
  const body = req.validated.body;
  const result = await categorizeTransaction({
    description: body.description,
    merchant: body.merchant || '',
    amount: fromCents(toCents(body.amount)),
    type: body.type,
  }, categories);
  res.json({ success: true, data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.validated.params.id)
    .populate('account', 'name currency type');
  if (!transaction) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
  assertCanRead(req.user, transaction.user);
  res.json({ success: true, data: presentTransaction(transaction) });
});

export const update = asyncHandler(async (req, res) => {
  const categories = await Category.find();
  const body = req.validated.body;
  const transaction = await updateTransaction({
    transactionId: req.validated.params.id,
    actor: req.user,
    categories,
    input: { ...body, amountCents: amountCents(body) },
  });
  res.json({ success: true, data: presentTransaction(transaction) });
});

export const categorize = asyncHandler(async (req, res) => {
  const categories = await Category.find();
  const transaction = await recategorizeTransaction({
    transactionId: req.validated.params.id,
    actor: req.user,
    categories,
  });
  res.json({ success: true, data: presentTransaction(transaction) });
});

export const remove = asyncHandler(async (req, res) => {
  await removeTransaction({
    transactionId: req.validated.params.id,
    actor: req.user,
  });
  res.status(204).send();
});
