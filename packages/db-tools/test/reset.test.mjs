import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestDatabase, makeFixture, plain, runCli } from '../test-support/helpers.mjs';

const migrations = {
  up: {
    '20260101000000_tasks.sql': 'CREATE TABLE tasks (id INT PRIMARY KEY);',
  },
  down: {
    '20260101000000_tasks.sql': 'DROP TABLE tasks;',
  },
};

async function tableNames(database) {
  const connection = await database.connect();

  try {
    const [rows] = await connection.query(
      `SELECT TABLE_NAME
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME`,
    );

    return rows.map((row) => row.TABLE_NAME);
  } finally {
    await connection.end();
  }
}

async function setup({ ownedTables = ['tasks'], includeOwnedTables = true } = {}) {
  const database = await createTestDatabase('db_tools_reset');
  const fixture = await makeFixture({
    ...(includeOwnedTables ? { ownedTables } : {}),
    ...migrations,
  });
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

test('reset drops only the owned tables by default', async () => {
  const ctx = await setup();

  try {
    let result = await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));

    const connection = await ctx.database.connect();
    await connection.query('CREATE TABLE foreign_table (id INT PRIMARY KEY)');
    await connection.end();

    result = await runCli(['reset', '--yes', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));

    const tables = await tableNames(ctx.database);
    assert.ok(tables.includes('tasks'));
    assert.ok(tables.includes('foreign_table'));
    assert.match(
      plain(result.stdout),
      /tables not declared in "ownedTables" were left untouched: foreign_table/,
    );
  } finally {
    await ctx.cleanup();
  }
});

test('reset --all-tables drops every base table', async () => {
  const ctx = await setup();

  try {
    let result = await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));

    const connection = await ctx.database.connect();
    await connection.query('CREATE TABLE foreign_table (id INT PRIMARY KEY)');
    await connection.end();

    result = await runCli(['reset', '--yes', '--all-tables', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));

    const tables = await tableNames(ctx.database);
    assert.ok(tables.includes('tasks'));
    assert.ok(!tables.includes('foreign_table'));
    assert.match(plain(result.stdout), /ALL BASE TABLES/);
  } finally {
    await ctx.cleanup();
  }
});

test('reset refuses to run without ownedTables', async () => {
  const ctx = await setup({ includeOwnedTables: false });

  try {
    let result = await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));

    result = await runCli(['reset', '--yes', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 1);
    assert.match(plain(result.stderr), /must define "ownedTables" \(or use --all-tables\)/);

    const tables = await tableNames(ctx.database);
    assert.ok(tables.includes('tasks'));
  } finally {
    await ctx.cleanup();
  }
});

test('reset allows --all-tables without ownedTables', async () => {
  const ctx = await setup({ includeOwnedTables: false });

  try {
    assert.equal((await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env)).code, 0);

    const result = await runCli(
      ['reset', '--yes', '--all-tables', '--dir', ctx.fixture.root],
      ctx.env,
    );

    assert.equal(result.code, 0, plain(result.stderr));
  } finally {
    await ctx.cleanup();
  }
});

test('reset requires --yes when stdin is not interactive', async () => {
  const ctx = await setup();

  try {
    const result = await runCli(['reset', '--dir', ctx.fixture.root], ctx.env);

    assert.equal(result.code, 2);
    assert.match(plain(result.stderr), /Use --yes to confirm/);
  } finally {
    await ctx.cleanup();
  }
});
