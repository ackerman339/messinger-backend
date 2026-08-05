import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger';

// Helper to parse comma-separated strings into arrays
const commaSeparated = z.string().transform((val) => val.split(',').map((s) => s.trim()));

const booleanString = z
  .string()
  .transform((val) => val === 'true')
  .pipe(z.boolean());

const ENVS = {
  development: '.env',
  test: '.env.test',
  staging: '.env.staging',
  production: '.env.production',
};

dotenv.config({
  path: ENVS[(process.env.NODE_ENV || 'development') as keyof typeof ENVS],
});

const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  // Project
  PROJECT_NAME: z.string().min(1),

  // Server
  PORT: z.coerce.number().int().positive(),
  API_PREFIX: z.string(),
  API_VERSION: z.string(),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_TEST_NAME: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'Invalid format, e.g: 24h, 7d, 60s'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'Invalid format, e.g: 24h, 7d, 60s'),

  // Cookie Config
  COOKIE_HTTP_ONLY: booleanString,
  COOKIE_SECURE: booleanString,
  COOKIE_DOMAIN: z.string(),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']),
  ACCESS_COOKIE_MAX_AGE: z.coerce.number().int().positive(),
  REFRESH_COOKIE_MAX_AGE: z.coerce.number().int().positive(),

  // CORS
  CORS_ORIGIN: commaSeparated,
  CORS_CREDENTIALS: booleanString,

  // Hashing
  SALT_ROUNDS: z.coerce.number().int().positive(),

  // HMAC
  LOGIN_KEY_SECRET: z
    .string()
    .length(128, 'LOGIN_KEY_SECRET must be 128 hex characters (64 bytes) for HMAC signing')
    .regex(/^[0-9a-f]+$/i, 'LOGIN_KEY_SECRET must be a valid hexadecimal string'),

  //Message encryption
  MESSAGE_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'APP_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)'
    )
    .transform((value) => Buffer.from(value, 'hex')),

  // Pagination
  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive(),
  MAX_PAGE_SIZE: z.coerce.number().int().positive(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).optional(),
  LOG_FILE_ERROR: z.string().optional(),
  LOG_FILE_COMBINED: z.string().optional(),
  LOG_FILE_ACCESS: z.string().optional(),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().int().positive().optional(),
  ALLOWED_FILE_TYPES: commaSeparated.optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional(),

  // Feature Flags
  ENABLE_SWAGGER: booleanString.optional(),
  ENABLE_RATE_LIMITING: booleanString.optional(),
  ENABLE_CACHING: booleanString.optional(),
  ENABLE_AUDIT_LOG: booleanString.optional(),

  // R2
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

    logger.error('Invalid environment variables', { errors });
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
