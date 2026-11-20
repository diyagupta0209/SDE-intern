import { z } from 'zod';
import { objectIdSchema, requestSchema } from './common.js';

const keywords = z.array(z.string().trim().min(1).max(40)).max(30);

export const createCategorySchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(2).max(60),
    kind: z.enum(['income', 'expense', 'both']),
    keywords: keywords.optional(),
  }).strict(),
});

export const updateCategorySchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
  body: z.object({
    name: z.string().trim().min(2).max(60).optional(),
    kind: z.enum(['income', 'expense', 'both']).optional(),
    keywords: keywords.optional(),
  }).strict().refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  }),
});

export const categoryIdSchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
});
