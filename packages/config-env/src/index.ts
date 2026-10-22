import dotenv from 'dotenv';
import type { z } from 'zod';

/** Loads the root `.env` (task cwd and repo root); real variables win. */
dotenv.config({
  path: ['../../.env', '.env'],
  quiet: true,
});

/**
 * Reads `process.env` once, dropping missing and empty variables so both behave
 * the same: the default applies or the field is required. Otherwise
 * `z.coerce.number()` turns an empty string into `0`.
 *
 * The empty names are kept so the error says "empty" instead of "missing".
 */
function sanitize(source: Record<string, string | undefined>) {
  const values: Record<string, string> = {};
  const empty = new Set<string>();

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    if (value.trim() === '') {
      empty.add(key);
      continue;
    }

    values[key] = value;
  }

  return { values, empty };
}

/** Validates `process.env`, reporting every problem at once so boot fails with all of them. */
export function createEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const { values, empty } = sanitize(process.env);
  const result = schema.safeParse(values);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const key = issue.path.join('.');
        const message = empty.has(key) ? 'defined but empty, so it was ignored' : issue.message;

        return `  - ${key}: ${message}`;
      })
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
