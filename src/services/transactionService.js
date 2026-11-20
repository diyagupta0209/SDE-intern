import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { AppError } from '../utils/AppError.js';
import { fromCents, signedCents } from '../utils/money.js';
import { assertCanMutate } from '../middleware/rbac.js';
import { categorizeTransaction } from './llmCategorizer.js';

async function applyDelta(account, delta) {
  if (!account || delta === 0) return account;
  const filter = { _id: account._id };
  if (delta < 0 && !account.allowNegative) {
    filter.balanceCents = { $gte: Math.abs(delta) };
  }
  const updated = await Account.findOneAndUpdate(
    filter,
    { $inc: { balanceCents: delta } },
    { new: true },
  );
  if (!updated) {
    throw new AppError('Insufficient funds for this expense', 422, 'INSUFFICIENT_FUNDS');
  }
  account.balanceCents = updated.balanceCents;
  account.allowNegative = updated.allowNegative;
  return updated;
}

function fieldsFromCategorization(result) {
  if (!result.categoryId) {
    throw new AppError('No category could be assigned', 500, 'CATEGORIZATION_FAILED');
  }
  return {
    category: result.categoryId,
    categoryName: result.category,
    categorySource: result.source,
    categoryConfidence: result.confidence,
    categoryReason: result.reason,
  };
}

function manualCategory(categoryId, categories) {
  const match = categories.find((category) => (
    category.id === categoryId || category._id?.toString() === categoryId
  ));
  if (!match) {
    throw new AppError('Category not found', 400, 'VALIDATION_ERROR');
  }
  return {
    category: match._id || match.id,
    categoryName: match.name,
    categorySource: 'manual',
    categoryConfidence: 1,
    categoryReason: 'Set by user',
  };
}

async function categorizeInput(input, categories) {
  const result = await categorizeTransaction({
    description: input.description,
    merchant: input.merchant || '',
    amount: fromCents(input.amountCents),
    type: input.type,
  }, categories);
  return fieldsFromCategorization(result);
}

async function compensate(previousAccount, previousDelta, nextAccount, nextDelta) {
  await applyDelta(nextAccount, -nextDelta);
  await applyDelta(previousAccount, previousDelta);
}

export async function createTransaction({ ownerId, input, categories }) {
  const account = await Account.findOne({
    _id: input.accountId,
    user: ownerId,
    isArchived: false,
  });
  if (!account) throw new AppError('Account not found', 404, 'NOT_FOUND');

  const categorization = input.categoryId
    ? manualCategory(input.categoryId, categories)
    : await categorizeInput(input, categories);

  const transaction = await Transaction.create({
    user: ownerId,
    account: account._id,
    type: input.type,
    amountCents: input.amountCents,
    description: input.description,
    merchant: input.merchant || '',
    occurredAt: input.occurredAt || new Date(),
    notes: input.notes || '',
    tags: input.tags || [],
    ...categorization,
  });

  try {
    await applyDelta(account, signedCents(input.type, input.amountCents));
  } catch (error) {
    await Transaction.deleteOne({ _id: transaction._id });
    throw error;
  }

  return Transaction.findById(transaction._id).populate('account', 'name currency type');
}

export async function updateTransaction({ transactionId, actor, input, categories }) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
  assertCanMutate(actor, transaction.user);

  const requestedAccountId = input.accountId || transaction.account.toString();
  const movingAccount = requestedAccountId !== transaction.account.toString();
  const nextAccount = await Account.findOne({
    _id: requestedAccountId,
    user: transaction.user,
    ...(movingAccount ? { isArchived: false } : {}),
  });
  if (!nextAccount) throw new AppError('Account not found', 404, 'NOT_FOUND');

  const previousAccount = nextAccount._id.equals(transaction.account)
    ? nextAccount
    : await Account.findById(transaction.account);
  if (!previousAccount) throw new AppError('Account not found', 404, 'NOT_FOUND');

  const nextType = input.type || transaction.type;
  const nextAmount = input.amountCents ?? transaction.amountCents;
  const previousDelta = signedCents(transaction.type, transaction.amountCents);
  const nextDelta = signedCents(nextType, nextAmount);
  const balanceChanged = !previousAccount._id.equals(nextAccount._id) || previousDelta !== nextDelta;

  if (balanceChanged) {
    await applyDelta(previousAccount, -previousDelta);
    try {
      await applyDelta(nextAccount, nextDelta);
    } catch (error) {
      await applyDelta(previousAccount, previousDelta);
      throw error;
    }
  }

  transaction.account = nextAccount._id;
  transaction.type = nextType;
  transaction.amountCents = nextAmount;
  if (input.description !== undefined) transaction.description = input.description;
  if (input.merchant !== undefined) transaction.merchant = input.merchant;
  if (input.occurredAt !== undefined) transaction.occurredAt = input.occurredAt;
  if (input.notes !== undefined) transaction.notes = input.notes;
  if (input.tags !== undefined) transaction.tags = input.tags;

  if (input.categoryId) {
    Object.assign(transaction, manualCategory(input.categoryId, categories));
  } else if (input.recategorize) {
    Object.assign(transaction, await categorizeInput({
      description: transaction.description,
      merchant: transaction.merchant,
      amountCents: transaction.amountCents,
      type: transaction.type,
    }, categories));
  }

  try {
    await transaction.save();
  } catch (error) {
    if (balanceChanged) await compensate(previousAccount, previousDelta, nextAccount, nextDelta);
    throw error;
  }

  return Transaction.findById(transaction.id).populate('account', 'name currency type');
}

export async function removeTransaction({ transactionId, actor }) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
  assertCanMutate(actor, transaction.user);

  const account = await Account.findById(transaction.account);
  if (account) {
    await applyDelta(account, -signedCents(transaction.type, transaction.amountCents));
  }
  await transaction.deleteOne();
  return transaction;
}

export async function recategorizeTransaction({ transactionId, actor, categories }) {
  return updateTransaction({
    transactionId,
    actor,
    input: { recategorize: true },
    categories,
  });
}
