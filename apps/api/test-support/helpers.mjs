import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createEnv } from '@repo/config-env';
import mysql from 'mysql2/promise';
import { z } from 'zod';

export const repoRoot = path.resolve(import.meta.dirname, '../../..');

const adminEnvSchema = z.object({
  MYSQL_ROOT_PASSWORD: z.string().min(1),
  MYSQL_HOST: z.string().min(1).default('localhost'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
});

const apiTestEnvSchema = z.object({
  NODE_ENV: z.literal('test'),
  LOG_LEVEL: z.literal('error'),
  HOST: z.string().min(1),
  ALLOWED_ORIGINS: z.string().min(1),
  MYSQL_DATABASE: z.string().min(1),
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().int().positive(),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
});

export function loadRootEnv() {
  const file = path.join(repoRoot, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

function getAdminEnv() {
  loadRootEnv();

  return createEnv(adminEnvSchema);
}

function quoteIdent(name) {
  return `\`${name.replace(/`/g, '``')}\``;
}

function connectionConfig(database) {
  const env = getAdminEnv();

  return {
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: 'root',
    password: env.MYSQL_ROOT_PASSWORD,
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
  const adminEnv = getAdminEnv();
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
    env: createEnv(apiTestEnvSchema, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      HOST: '127.0.0.1',
      ALLOWED_ORIGINS: 'http://localhost:3000',
      MYSQL_DATABASE: name,
      MYSQL_HOST: adminEnv.MYSQL_HOST,
      MYSQL_PORT: String(adminEnv.MYSQL_PORT),
      MYSQL_USER: 'root',
      MYSQL_PASSWORD: adminEnv.MYSQL_ROOT_PASSWORD,
    }),
    async drop() {
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
      await admin.end();
    },
  };
}
