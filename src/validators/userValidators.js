import { z } from 'zod';
import { ROLE_VALUES } from '../constants/roles.js';
import { objectIdSchema, requestSchema } from './common.js';

const password = z.string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  role: z.enum(ROLE_VALUES).optional(),
  q: z.string().trim().max(80).optional(),
}).strict();

export const listUsersSchema = requestSchema({ query: listQuery });

export const userIdSchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
});

export const createUserSchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
    password,
    role: z.enum(ROLE_VALUES).optional(),
  }).strict(),
});

export const updateUserSchema = requestSchema({
  params: z.object({ id: objectIdSchema }).strict(),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    currentPassword: z.string().min(1).max(72).optional(),
    newPassword: password.optional(),
    role: z.enum(ROLE_VALUES).optional(),
    isActive: z.boolean().optional(),
  }).strict().refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  }),
});
