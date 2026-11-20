import { Router } from 'express';
import {
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../constants/roles.js';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userIdSchema,
} from '../validators/userValidators.js';

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.post('/', authorize(ROLES.ADMIN), validate(createUserSchema), createUser);
userRouter.get('/', authorize(ROLES.ADMIN, ROLES.ANALYST), validate(listUsersSchema), listUsers);
userRouter.get('/:id', validate(userIdSchema), getUser);
userRouter.patch('/:id', validate(updateUserSchema), updateUser);
userRouter.delete('/:id', authorize(ROLES.ADMIN), validate(userIdSchema), deactivateUser);
