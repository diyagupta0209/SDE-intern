import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  const origin = env.corsOrigin === '*'
    ? '*'
    : env.corsOrigin.split(',').map((value) => value.trim()).filter(Boolean);
  app.use(cors({ origin }));
  app.use(express.json({ limit: '1mb' }));

  if (env.nodeEnv !== 'test') {
    app.use(morgan('combined'));
  }

  app.use((req, res, next) => {
    const incoming = req.get('x-request-id');
    const requestId = incoming && /^[\w-]{1,80}$/.test(incoming) ? incoming : crypto.randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'zorvyn-fintech-api',
        mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      },
    });
  });

  app.use('/api/v1', apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
