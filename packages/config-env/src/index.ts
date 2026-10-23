import dotenv from 'dotenv';
import type { z } from 'zod';

export type EnvSource = Record<string, string | undefined>;

/** Loads `.env` files (task cwd and repo root by default); real variables win. */
export function loadEnv(paths: string | string[] = ['../../.env', '.env']): void {
  dotenv.config({
    path: paths,
    quiet: true,
    override: false,
  });
}

/**
 * Reads the source once, dropping missing and empty variables so both behave
 * the same: the default applies or the field is required. Otherwise
 * `z.coerce.number()` turns an empty string into `0`.
 *
 * The empty names are kept so the error says "empty" instead of "missing".
 */
function sanitize(source: EnvSource) {
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

/** Validates the source, reporting every problem at once so boot fails with all of them. */
export function createEnv<T extends z.ZodType>(
  schema: T,
  source: EnvSource = process.env,
): z.infer<T> {
  const { values, empty } = sanitize(source);
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
