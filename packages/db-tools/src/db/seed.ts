import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Connection } from 'mysql2/promise';
import { C } from '../colors.js';
import { getDbEnv, loadServiceEnv } from '../config/env.js';
import { connect, withLock } from './client.js';
import { loadConfig, type DbConfig } from './config.js';

export type Seed = {
  file: string;
  name: string;
  sql: string;
};

export type SeedOptions = {
  list?: boolean;
  dryRun?: boolean;
  file?: string;
};

export async function loadSeeds(dir: string): Promise<Seed[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const list = await Promise.all(
    files
      .filter((f) => f.endsWith('.sql'))
      .map(async (file): Promise<Seed> => {
        const sql = await readFile(path.join(dir, file), 'utf8');
        return { file, name: file.replace(/\.sql$/, ''), sql };
      }),
  );

  return list.sort((a, b) => a.file.localeCompare(b.file));
}

function printSeeds(seeds: Seed[]): void {
  for (const seed of seeds) console.log(`  ${C.cyan}>${C.reset} ${seed.file}`);
}

export async function listSeeds(cfg: DbConfig): Promise<void> {
  const all = await loadSeeds(cfg.seedsDir);

  if (all.length === 0) {
    console.log('(no seeds)');
    return;
  }

  printSeeds(all);
}

async function runSeed(client: Connection, seed: Seed): Promise<void> {
  await client.beginTransaction();

  try {
    await client.query(seed.sql);
    await client.commit();
  } catch (error) {
    await client.rollback();
    throw error;
  }
}

export async function applySeeds(
  client: Connection,
  cfg: DbConfig,
  opts: SeedOptions = {},
): Promise<void> {
  const all = await loadSeeds(cfg.seedsDir);

  let seeds = all;

  if (opts.file) {
    seeds = all.filter((seed) => seed.name === opts.file || seed.file === opts.file);

    if (seeds.length === 0) throw new Error(`seed not found: ${opts.file}`);
  }

  if (seeds.length === 0) {
    console.log('No seeds to apply (the seeds directory is empty).');
    return;
  }

  console.log(`Seeds (${seeds.length})${opts.dryRun ? ' [dry-run]' : ''}:`);
  printSeeds(seeds);

  if (opts.dryRun) {
    console.log(`${C.dim}--dry-run: nothing was executed${C.reset}`);
    return;
  }

  for (const seed of seeds) {
    await runSeed(client, seed);
    console.log(`${C.green}Applied${C.reset} ${seed.file}`);
  }
}

export async function run(argv: string[]): Promise<void> {
  const opts: SeedOptions = { list: false, dryRun: false };
  let dir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === '--list') opts.list = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--file') opts.file = argv[++i]?.replace(/\.sql$/, '');
    else if (a === '--dir') dir = argv[++i];
    else {
      console.error('usage: dbmigrate seed [--dir <root>] [--file <name>] [--list] [--dry-run]');
      process.exitCode = 2;
      return;
    }
  }

  const cfg = loadConfig(dir);

  if (opts.list) {
    await listSeeds(cfg);
    return;
  }

  loadServiceEnv();
  const client = await connect(getDbEnv());

  try {
    await withLock(client, cfg.service, () => applySeeds(client, cfg, opts));
  } finally {
    await client.end();
  }
}
