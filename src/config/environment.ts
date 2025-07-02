import { z } from 'zod';

// Environment validation schema
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RETRY_ATTEMPTS: z.string().transform(Number).default('3'),
  CIRCUIT_BREAKER_THRESHOLD: z.string().transform(Number).default('5'),
  CIRCUIT_BREAKER_TIMEOUT: z.string().transform(Number).default('60000'),
  DB_POOL_MIN: z.string().transform(Number).default('2'),
  DB_POOL_MAX: z.string().transform(Number).default('10'),
  // OpenRouter configuration
  OPENROUTER_API_KEY: z.string().min(1, 'OpenRouter API key is required'),
  SITE_URL: z.string().url().optional(),
  SITE_NAME: z.string().optional(),
  // R2 configuration
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2 access key ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2 secret access key is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2 bucket name is required'),
  R2_ACCOUNT_ID: z.string().min(1, 'R2 account ID is required'),
});

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

function validateEnvironment(): EnvironmentConfig {
  try {
    return environmentSchema.parse(process.env);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(
        (err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      throw new Error(`Environment validation failed:\n${formattedErrors}`);
    }
    throw error;
  }
}

function getEnvironmentConfig(): EnvironmentConfig {
  return validateEnvironment();
}

function isDevelopment(): boolean {
  return getEnvironmentConfig().NODE_ENV === 'development';
}

function isProduction(): boolean {
  return getEnvironmentConfig().NODE_ENV === 'production';
}

function isTest(): boolean {
  return getEnvironmentConfig().NODE_ENV === 'test';
}

export {
  getEnvironmentConfig,
  isDevelopment,
  isProduction,
  isTest,
}; 