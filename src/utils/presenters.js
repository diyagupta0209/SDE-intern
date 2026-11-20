import { fromCents } from './money.js';

export function idOf(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value.toHexString === 'function') return value.toHexString();
  return String(value);
}

export function presentAccount(account) {
  return {
    id: idOf(account),
    userId: idOf(account.user),
    name: account.name,
    type: account.type,
    currency: account.currency,
    balance: fromCents(account.balanceCents),
    institution: account.institution || '',
    allowNegative: account.allowNegative,
    isArchived: account.isArchived,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function presentCategory(category) {
  return {
    id: idOf(category),
    name: category.name,
    slug: category.slug,
    kind: category.kind,
    keywords: category.keywords || [],
    isSystem: category.isSystem,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export function presentTransaction(transaction) {
  const populated = transaction.account && typeof transaction.account === 'object' && transaction.account.name;
  const account = populated
    ? {
      id: idOf(transaction.account),
      name: transaction.account.name,
      currency: transaction.account.currency,
      type: transaction.account.type,
    }
    : { id: idOf(transaction.account) };

  return {
    id: idOf(transaction),
    userId: idOf(transaction.user),
    account,
    type: transaction.type,
    amount: fromCents(transaction.amountCents),
    description: transaction.description,
    merchant: transaction.merchant || '',
    category: {
      id: idOf(transaction.category),
      name: transaction.categoryName,
    },
    categorySource: transaction.categorySource,
    categoryConfidence: transaction.categoryConfidence,
    categoryReason: transaction.categoryReason || '',
    occurredAt: transaction.occurredAt,
    notes: transaction.notes || '',
    tags: transaction.tags || [],
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export function pageMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    pages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
