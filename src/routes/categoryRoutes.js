import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoryController.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from '../validators/categoryValidators.js';

export const categoryRouter = Router();

categoryRouter.use(authenticate);
categoryRouter.get('/', listCategories);
categoryRouter.post('/', authorize(ROLES.ADMIN), validate(createCategorySchema), createCategory);
categoryRouter.patch('/:id', authorize(ROLES.ADMIN), validate(updateCategorySchema), updateCategory);
categoryRouter.delete('/:id', authorize(ROLES.ADMIN), validate(categoryIdSchema), deleteCategory);
