import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getCliEnv, getDbEnv, loadServiceEnv } from '../dist/config/env.js';

const validDatabaseEnv = {
  MYSQL_HOST: 'localhost',
  MYSQL_USER: 'desafio',
  MYSQL_PASSWORD: 'desafio',
  MYSQL_DATABASE: 'desafio',
};

test('getDbEnv validates the database variables and defaults the port', () => {
  assert.deepEqual(getDbEnv(validDatabaseEnv), {
    ...validDatabaseEnv,
    MYSQL_PORT: 3306,
  });
});

test('getDbEnv reports every missing database variable', () => {
  assert.throws(
    () => getDbEnv({}),
    (error) => {
      for (const key of Object.keys(validDatabaseEnv)) {
        assert.match(error.message, new RegExp(key));
      }

      return true;
    },
  );
});

test('getDbEnv reports empty and invalid values', () => {
  assert.throws(
    () => getDbEnv({ ...validDatabaseEnv, MYSQL_PASSWORD: '' }),
    /MYSQL_PASSWORD: defined but empty/,
  );
  assert.throws(() => getDbEnv({ ...validDatabaseEnv, MYSQL_PORT: 'not-a-port' }), /MYSQL_PORT/);
});

test('getCliEnv defaults NODE_ENV to production', () => {
  assert.equal(getCliEnv({}).NODE_ENV, 'production');
  assert.equal(getCliEnv({ NODE_ENV: 'test' }).NODE_ENV, 'test');
  assert.throws(() => getCliEnv({ NODE_ENV: 'staging' }), /NODE_ENV/);
});

test('loadServiceEnv loads the selected root .env without overriding real variables', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'db-tools-env-'));
  const previous = process.env.MYSQL_HOST;

  try {
    await writeFile(path.join(root, '.env'), 'MYSQL_HOST=from-file\n');

    delete process.env.MYSQL_HOST;
    loadServiceEnv(root);
    assert.equal(process.env.MYSQL_HOST, 'from-file');

    process.env.MYSQL_HOST = 'explicit';
    loadServiceEnv(root);
    assert.equal(process.env.MYSQL_HOST, 'explicit');
  } finally {
    if (previous === undefined) delete process.env.MYSQL_HOST;
    else process.env.MYSQL_HOST = previous;

    await rm(root, { recursive: true, force: true });
  }
});

test('loadServiceEnv ignores a missing .env file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'db-tools-env-'));

  try {
    assert.doesNotThrow(() => loadServiceEnv(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('loadServiceEnv falls back to the repository root .env', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'db-tools-env-'));
  const previous = process.env.MYSQL_USER;

  try {
    delete process.env.MYSQL_USER;
    loadServiceEnv(root);
    assert.ok(process.env.MYSQL_USER);
  } finally {
    if (previous === undefined) delete process.env.MYSQL_USER;
    else process.env.MYSQL_USER = previous;

    await rm(root, { recursive: true, force: true });
  }
});
