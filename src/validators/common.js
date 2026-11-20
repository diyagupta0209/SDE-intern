import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

export const moneySchema = z.union([
  z.number().positive(),
  z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, 'Must be a positive amount with up to 2 decimals'),
]);

export function requestSchema({ body, params, query } = {}) {
  return z.object({
    body: body ?? z.object({}).strict(),
    params: params ?? z.object({}).strict(),
    query: query ?? z.object({}).strict(),
  });
}
