import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type DbConfig = {
  service: string;
  root: string;
  migrations: string;
  seeds: string;
  upDir: string;
  downDir: string;
  seedsDir: string;
  ownedTables: string[];
};

type RawDbConfig = {
  service?: string;
  migrations?: string;
  seeds?: string;
  ownedTables?: string[];
};

export function loadConfig(dir?: string): DbConfig {
  const root = path.resolve(process.cwd(), dir ?? '.');
  const file = path.join(root, 'db-tools.json');

  if (!existsSync(file)) {
    throw new Error(`db-tools.json not found at ${root}`);
  }

  const raw = JSON.parse(readFileSync(file, 'utf8')) as RawDbConfig;

  if (!raw.service) {
    throw new Error('db-tools.json must define "service"');
  }

  if (
    raw.ownedTables !== undefined &&
    (!Array.isArray(raw.ownedTables) ||
      raw.ownedTables.some((table) => typeof table !== 'string' || table.trim() === ''))
  ) {
    throw new Error('db-tools.json "ownedTables" must be an array of non-empty strings');
  }

  const migrations = path.resolve(root, raw.migrations ?? 'db/migrations');
  const seeds = path.resolve(root, raw.seeds ?? 'db/seeds');

  return {
    service: raw.service,
    root,
    migrations,
    seeds,
    upDir: path.join(migrations, 'up'),
    downDir: path.join(migrations, 'down'),
    seedsDir: seeds,
    ownedTables: raw.ownedTables ?? [],
  };
}
