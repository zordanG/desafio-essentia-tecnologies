import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

export const repoRoot = path.resolve(import.meta.dirname, '../../..');

export function loadRootEnv() {
  const file = path.join(repoRoot, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

function quoteIdent(name) {
  return `\`${name.replace(/`/g, '``')}\``;
}

function connectionConfig(database) {
  const password = process.env.MYSQL_ROOT_PASSWORD;

  if (!password) {
    throw new Error('MYSQL_ROOT_PASSWORD is required to run the API integration tests');
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

async function applyMigrations(database) {
  const upDir = path.join(repoRoot, 'apps/api/db/migrations/up');
  const files = (await readdir(upDir)).filter((file) => file.endsWith('.sql')).sort();
  const connection = await mysql.createConnection(connectionConfig(database));

  try {
    for (const file of files) {
      await connection.query(await readFile(path.join(upDir, file), 'utf8'));
    }
  } finally {
    await connection.end();
  }
}

export async function createApiDatabase() {
  loadRootEnv();

  const suffix = `${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const name = `api_test_${suffix}`.slice(0, 60);
  const admin = await mysql.createConnection(connectionConfig());

  await admin.query(
    `CREATE DATABASE ${quoteIdent(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );

  try {
    await applyMigrations(name);
  } catch (error) {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
    await admin.end();
    throw error;
  }

  return {
    name,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      HOST: '127.0.0.1',
      ALLOWED_ORIGINS: 'http://localhost:3000',
      MYSQL_DATABASE: name,
      MYSQL_HOST: process.env.MYSQL_HOST ?? 'localhost',
      MYSQL_PORT: process.env.MYSQL_PORT ?? '3306',
      MYSQL_USER: 'root',
      MYSQL_PASSWORD: process.env.MYSQL_ROOT_PASSWORD,
    },
    async drop() {
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
      await admin.end();
    },
  };
}
