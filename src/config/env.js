import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const duration = z.string().regex(/^\d+[smhd]$/, 'Use a duration like 15m, 12h, or 7d');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: duration.default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_EXPIRES_IN: duration.default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  LLM_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().min(1).default('gpt-4o-mini'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  CORS_ORIGIN: z.string().default('*'),
  SEED_ADMIN_NAME: z.string().default('Zorvyn Admin'),
  SEED_ADMIN_EMAIL: z.string().default(''),
  SEED_ADMIN_PASSWORD: z.string().default(''),
});

let cached;

export function getEnv() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid environment: ${details}`);
    }
    const value = parsed.data;
    cached = {
      nodeEnv: value.NODE_ENV,
      port: value.PORT,
      mongodbUri: value.MONGODB_URI,
      jwtSecret: value.JWT_SECRET,
      jwtExpiresIn: value.JWT_EXPIRES_IN,
      jwtRefreshSecret: value.JWT_REFRESH_SECRET,
      jwtRefreshExpiresIn: value.JWT_REFRESH_EXPIRES_IN,
      bcryptRounds: value.BCRYPT_ROUNDS,
      llmApiKey: value.LLM_API_KEY,
      llmBaseUrl: value.LLM_BASE_URL.replace(/\/$/, ''),
      llmModel: value.LLM_MODEL,
      llmTimeoutMs: value.LLM_TIMEOUT_MS,
      corsOrigin: value.CORS_ORIGIN,
      seedAdminName: value.SEED_ADMIN_NAME,
      seedAdminEmail: value.SEED_ADMIN_EMAIL,
      seedAdminPassword: value.SEED_ADMIN_PASSWORD,
    };
  }
  return cached;
}

export function resetEnvCache() {
  cached = undefined;
}
