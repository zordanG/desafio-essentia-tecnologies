import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';

export const repoRoot = path.resolve(import.meta.dirname, '../../..');
export const cliPath = path.join(repoRoot, 'packages/db-tools/dist/cli.js');
export const databaseEnvKeys = [
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
];

export function loadRootEnv() {
  const file = path.join(repoRoot, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

function quoteIdent(name) {
  return `\`${name.replace(/`/g, '``')}\``;
}

export function connectionConfig(database) {
  const password = process.env.MYSQL_ROOT_PASSWORD;

  if (!password) {
    throw new Error('MYSQL_ROOT_PASSWORD is required to run the database integration tests');
  }

  return {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: 'root',
    password,
    ...(database ? { database } : {}),
    multipleStatements: true,
    timezone: 'Z',
  };
}

export async function createTestDatabase(prefix) {
  loadRootEnv();

  const suffix = `${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const name = `${prefix}_${suffix}`.slice(0, 60);
  const admin = await mysql.createConnection(connectionConfig());

  await admin.query(
    `CREATE DATABASE ${quoteIdent(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );

  return {
    name,
    env: {
      MYSQL_DATABASE: name,
      MYSQL_HOST: process.env.MYSQL_HOST ?? 'localhost',
      MYSQL_PORT: process.env.MYSQL_PORT ?? '3306',
      MYSQL_USER: 'root',
      MYSQL_PASSWORD: process.env.MYSQL_ROOT_PASSWORD,
    },
    async connect() {
      return mysql.createConnection(connectionConfig(name));
    },
    async drop() {
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
      await admin.end();
    },
  };
}

export async function makeFixture({ service, ownedTables, up = {}, down = {}, seeds = {} }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'db-tools-fixture-'));
  const serviceName =
    service ?? `test_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const config = {
    service: serviceName,
    migrations: 'db/migrations',
    seeds: 'db/seeds',
  };

  if (ownedTables !== undefined) config.ownedTables = ownedTables;

  await writeFile(path.join(root, 'db-tools.json'), JSON.stringify(config, null, 2));

  async function writeFiles(dir, files) {
    await mkdir(dir, { recursive: true });

    for (const [file, sql] of Object.entries(files)) {
      await writeFile(path.join(dir, file), sql);
    }
  }

  await writeFiles(path.join(root, 'db/migrations/up'), up);
  await writeFiles(path.join(root, 'db/migrations/down'), down);
  await writeFiles(path.join(root, 'db/seeds'), seeds);

  return {
    root,
    service: serviceName,
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

export function runCli(args, env = {}, { omitEnv = [] } = {}) {
  const childEnv = { ...process.env, ...env };
  for (const key of omitEnv) delete childEnv[key];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

export function plain(text) {
  return text.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '');
}
