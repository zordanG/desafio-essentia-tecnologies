import dotenv from 'dotenv';
import type { z } from 'zod';

/**
 * Loads the root `.env` file: the first path covers the workspace directory
 * used by Turborepo tasks, the second the repository root. Existing variables
 * are never overwritten, so the real environment wins over the file.
 */
dotenv.config({
  path: ['../../.env', '.env'],
  quiet: true,
});

/**
 * Validates `process.env` against the given schema and returns the parsed
 * values. Every invalid or missing variable is reported at once, so the
 * process fails at boot.
 */
export function createEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
