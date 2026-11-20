import { Router } from 'express';
import {
  categorize,
  create,
  getOne,
  list,
  preview,
  remove,
  summary,
  update,
} from '../controllers/transactionController.js';
import { authenticate } from '../middleware/auth.js';
import { categorizeRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  createTransactionSchema,
  listTransactionsSchema,
  previewSchema,
  summarySchema,
  transactionIdSchema,
  updateTransactionSchema,
} from '../validators/transactionValidators.js';

export const transactionRouter = Router();
const categorizeLimit = categorizeRateLimiter();

transactionRouter.use(authenticate);
transactionRouter.post('/categorize-preview', categorizeLimit, validate(previewSchema), preview);
transactionRouter.get('/summary', validate(summarySchema), summary);
transactionRouter.post('/', validate(createTransactionSchema), create);
transactionRouter.get('/', validate(listTransactionsSchema), list);
transactionRouter.get('/:id', validate(transactionIdSchema), getOne);
transactionRouter.patch('/:id', validate(updateTransactionSchema), update);
transactionRouter.post('/:id/categorize', categorizeLimit, validate(transactionIdSchema), categorize);
transactionRouter.delete('/:id', validate(transactionIdSchema), remove);
