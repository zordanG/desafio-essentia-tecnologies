import { createEnv, loadEnv } from '@repo/config-env';

import { z } from 'zod';

loadEnv('../../.env');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string()).min(1)),
  MYSQL_HOST: z.string(),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string(),
  MYSQL_PASSWORD: z.string(),
  MYSQL_DATABASE: z.string(),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32).optional(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string(),
  MONGODB_URI: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === 'mongodb:' || url.protocol === 'mongodb+srv:') && url.hostname.length > 0
      );
    } catch {
      return false;
    }
  }, 'Invalid MONGODB_URI'),
});

export const env = createEnv(schema);
