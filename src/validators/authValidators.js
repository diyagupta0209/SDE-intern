import { z } from 'zod';
import { requestSchema } from './common.js';

const name = z.string().trim().min(2).max(80);
const email = z.string().trim().email().max(160).transform((value) => value.toLowerCase());
const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = requestSchema({
  body: z.object({
    name,
    email,
    password,
  }).strict(),
});

export const loginSchema = requestSchema({
  body: z.object({
    email,
    password: z.string().min(1).max(72),
  }).strict(),
});

export const refreshSchema = requestSchema({
  body: z.object({
    refreshToken: z.string().min(20),
  }).strict(),
});
