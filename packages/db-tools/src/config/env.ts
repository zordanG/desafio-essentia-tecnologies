import path from 'node:path';
import { z } from 'zod';
import { createEnv, loadEnv, type EnvSource } from '@repo/config-env';

const cliSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
});

const dbSchema = z.object({
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_DATABASE: z.string().min(1),
});

export type CliEnv = z.infer<typeof cliSchema>;
export type DbEnv = z.infer<typeof dbSchema>;

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

/** Loads the repository root `.env`. Variables already present in the process win. */
export function loadServiceEnv(): void {
  loadEnv(path.join(repositoryRoot, '.env'));
}

export function getCliEnv(source: EnvSource = process.env): CliEnv {
  return createEnv(cliSchema, source);
}

/** Validates the database variables only when a command needs a connection. */
export function getDbEnv(source: EnvSource = process.env): DbEnv {
  return createEnv(dbSchema, source);
}
