import { Router } from 'express';
import {
  archiveAccount,
  createAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from '../controllers/accountController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  accountIdSchema,
  createAccountSchema,
  listAccountsSchema,
  updateAccountSchema,
} from '../validators/accountValidators.js';

export const accountRouter = Router();

accountRouter.use(authenticate);
accountRouter.post('/', validate(createAccountSchema), createAccount);
accountRouter.get('/', validate(listAccountsSchema), listAccounts);
accountRouter.get('/:id', validate(accountIdSchema), getAccount);
accountRouter.patch('/:id', validate(updateAccountSchema), updateAccount);
accountRouter.delete('/:id', validate(accountIdSchema), archiveAccount);
