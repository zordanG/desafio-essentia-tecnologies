import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  createTestDatabase,
  databaseEnvKeys,
  makeFixture,
  plain,
  runCli,
} from '../test-support/helpers.mjs';

const baseMigrations = {
  up: {
    '20260101000000_tasks.sql': 'CREATE TABLE tasks (id INT PRIMARY KEY);',
  },
  down: {
    '20260101000000_tasks.sql': 'DROP TABLE tasks;',
  },
};

async function setup(extra = {}) {
  const database = await createTestDatabase('db_tools_migrate');
  const fixture = await makeFixture({ ownedTables: ['tasks'], ...baseMigrations, ...extra });
  const env = { ...database.env, NODE_ENV: 'test' };

  return {
    database,
    fixture,
    env,
    async cleanup() {
      await fixture.cleanup();
      await database.drop();
    },
  };
}

async function tableExists(database, table) {
  const connection = await database.connect();

  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS count
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );

    return Number(rows[0].count) === 1;
  } finally {
    await connection.end();
  }
}

test('migrate status/up block an interrupted migration', async () => {
  const ctx = await setup();

  try {
    assert.equal((await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env)).code, 0);

    const connection = await ctx.database.connect();
    await connection.query(
      `UPDATE schema_migrations
          SET status = 'running', applied_at = NULL
        WHERE service = ? AND version = '20260101000000'`,
      [ctx.fixture.service],
    );
    await connection.end();

    let result = await runCli(['migrate', 'status', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 1);
    assert.match(plain(result.stdout), /\[!\]/);
    assert.match(plain(result.stdout), /Interrupted migrations found/);

    result = await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 1);
    assert.match(plain(result.stderr), /migration state is not clean/);

    const repair = await ctx.database.connect();
    await repair.query(
      `UPDATE schema_migrations
          SET status = 'applied', applied_at = CURRENT_TIMESTAMP(3)
        WHERE service = ? AND version = '20260101000000'`,
      [ctx.fixture.service],
    );
    await repair.end();

    result = await runCli(['migrate', 'status', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));
  } finally {
    await ctx.cleanup();
  }
});

test('migrate refuses an edited up file', async () => {
  const ctx = await setup();

  try {
    assert.equal((await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env)).code, 0);

    await writeFile(
      path.join(ctx.fixture.root, 'db/migrations/up/20260101000000_tasks.sql'),
      'CREATE TABLE tasks (id INT PRIMARY KEY, title VARCHAR(255));',
    );

    let result = await runCli(['migrate', 'status', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 1);
    assert.match(plain(result.stdout), /checksum mismatch/);

    result = await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 1);
    assert.match(plain(result.stderr), /migration record is inconsistent \(checksum\)/);

    result = await runCli(['migrate', 'down', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 1);
    assert.match(plain(result.stderr), /migration record is inconsistent \(checksum\)/);
  } finally {
    await ctx.cleanup();
  }
});

test('migrate down fails while another process holds the lock', async () => {
  const ctx = await setup();

  try {
    assert.equal((await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env)).code, 0);

    const holder = await ctx.database.connect();
    const lockName = `dbmigrate:${ctx.fixture.service}`;
    const [rows] = await holder.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    assert.equal(rows[0].acquired, 1);

    try {
      const result = await runCli(['migrate', 'down', '--dir', ctx.fixture.root], ctx.env);
      assert.equal(result.code, 1);
      assert.match(plain(result.stderr), /could not acquire migration lock/);
    } finally {
      await holder.query('SELECT RELEASE_LOCK(?)', [lockName]);
      await holder.end();
    }

    const result = await runCli(['migrate', 'down', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));
    assert.ok(!(await tableExists(ctx.database, 'tasks')));
  } finally {
    await ctx.cleanup();
  }
});

test('migrate rejects duplicate versions before applying', async () => {
  const ctx = await setup({
    up: {
      '20260101000000_tasks.sql': 'CREATE TABLE tasks (id INT PRIMARY KEY);',
      '20260101000000_other.sql': 'CREATE TABLE other (id INT PRIMARY KEY);',
    },
  });

  try {
    const result = await runCli(['migrate', 'status', '--dir', ctx.fixture.root], ctx.env);

    assert.equal(result.code, 1);
    assert.match(plain(result.stderr), /duplicate migration version 20260101000000/);
    assert.ok(!(await tableExists(ctx.database, 'tasks')));
  } finally {
    await ctx.cleanup();
  }
});

test('migrate up, down and up restores the schema', async () => {
  const ctx = await setup();

  try {
    let result = await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));
    assert.ok(await tableExists(ctx.database, 'tasks'));

    result = await runCli(['migrate', 'down', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));
    assert.ok(!(await tableExists(ctx.database, 'tasks')));

    result = await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));
    assert.ok(await tableExists(ctx.database, 'tasks'));
  } finally {
    await ctx.cleanup();
  }
});

test('migrate loads the database env from the selected --dir root', async () => {
  const ctx = await setup();

  try {
    const envFile = Object.entries(ctx.database.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await writeFile(path.join(ctx.fixture.root, '.env'), envFile);

    const result = await runCli(
      ['migrate', 'up', '--dir', ctx.fixture.root],
      {},
      {
        omitEnv: databaseEnvKeys,
      },
    );

    assert.equal(result.code, 0, plain(result.stderr));
    assert.ok(await tableExists(ctx.database, 'tasks'));
  } finally {
    await ctx.cleanup();
  }
});
