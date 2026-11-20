import { Router } from 'express';
import { accountRouter } from './accountRoutes.js';
import { authRouter } from './authRoutes.js';
import { categoryRouter } from './categoryRoutes.js';
import { transactionRouter } from './transactionRoutes.js';
import { userRouter } from './userRoutes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/accounts', accountRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/transactions', transactionRouter);
