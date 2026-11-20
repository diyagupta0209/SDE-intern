import { z } from 'zod';
import { moneySchema, objectIdSchema, requestSchema } from './common.js';

const tags = z.array(z.string().trim().min(1).max(24)).max(8);

const writeFields = {
  accountId: objectIdSchema,
  type: z.enum(['income', 'expense']),
  amount: moneySchema,
  description: z.string().trim().min(2).max(200),
  merchant: z.string().trim().max(80).optional(),
  categoryId: objectIdSchema.optional(),
  occurredAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
  tags: tags.optional(),
};

export const createTransactionSchema = requestSchema({
  body: z.object(writeFields).strict(),
});

export const listTransactionsSchema = requestSchema({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    userId: objectIdSchema.optional(),
    accountId: objectIdSchema.optional(),
    categoryId: objectIdSchema.optional(),
    type: z.enum(['income', 'expense']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    q: z.string().trim().max(80).optional(),
    sort: z.string().regex(/^-?(date|amount|createdAt)$/).default('-date'),
  }).strict(),
});

export const summarySchema = requestSchema({
  query: z.object({
    userId: objectIdSchema.optional(),
    accountId: objectIdSchema.optional(),
    categoryId: objectIdSchema.optional(),
    type: z.enum(['income', 'expense']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }).strict(),
});

export const transactionIdSchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
});

export const updateTransactionSchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
  body: z.object({
    accountId: objectIdSchema.optional(),
    type: z.enum(['income', 'expense']).optional(),
    amount: moneySchema.optional(),
    description: z.string().trim().min(2).max(200).optional(),
    merchant: z.string().trim().max(80).optional(),
    categoryId: objectIdSchema.optional(),
    occurredAt: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
    tags: tags.optional(),
    recategorize: z.boolean().optional(),
  }).strict().refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  }),
});

export const previewSchema = requestSchema({
  body: z.object({
    description: z.string().trim().min(2).max(200),
    merchant: z.string().trim().max(80).optional(),
    amount: moneySchema,
    type: z.enum(['income', 'expense']),
  }).strict(),
});
