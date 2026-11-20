import { z } from 'zod';
import { ACCOUNT_TYPES_LIST } from '../models/Account.js';
import { moneySchema, objectIdSchema, requestSchema } from './common.js';

const currency = z.string().trim().regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code')
  .transform((value) => value.toUpperCase());

export const createAccountSchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(ACCOUNT_TYPES_LIST),
    currency: currency.optional(),
    institution: z.string().trim().max(80).optional(),
    allowNegative: z.boolean().optional(),
    openingBalance: moneySchema.optional(),
  }).strict(),
});

export const listAccountsSchema = requestSchema({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    userId: objectIdSchema.optional(),
    type: z.enum(ACCOUNT_TYPES_LIST).optional(),
    includeArchived: z.enum(['true', 'false']).optional(),
  }).strict(),
});

export const accountIdSchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
});

export const updateAccountSchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    institution: z.string().trim().max(80).optional(),
    allowNegative: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  }).strict().refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  }),
});
