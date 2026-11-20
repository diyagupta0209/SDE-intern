import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { getEnv } from './config/env.js';
import { ensureDefaultCategories } from './services/categoryService.js';

const env = getEnv();

try {
  await connectDb(env.mongodbUri);
  await ensureDefaultCategories();
} catch (error) {
  console.error('Failed to connect to MongoDB', error);
  process.exit(1);
}

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Zorvyn API listening on port ${env.port}`);
});

async function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
