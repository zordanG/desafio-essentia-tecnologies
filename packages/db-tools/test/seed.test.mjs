import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTestDatabase,
  databaseEnvKeys,
  makeFixture,
  plain,
  runCli,
} from '../test-support/helpers.mjs';

const migrations = {
  up: {
    '20260101000000_tasks.sql':
      'CREATE TABLE tasks (id INT PRIMARY KEY AUTO_INCREMENT, title VARCHAR(255) NOT NULL);',
  },
  down: {
    '20260101000000_tasks.sql': 'DROP TABLE tasks;',
  },
};

async function setup(seeds) {
  const database = await createTestDatabase('db_tools_seed');
  const fixture = await makeFixture({ ownedTables: ['tasks'], ...migrations, seeds });
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

async function countTasks(database) {
  const connection = await database.connect();

  try {
    const [rows] = await connection.query('SELECT COUNT(*) AS count FROM tasks');
    return Number(rows[0].count);
  } finally {
    await connection.end();
  }
}

test('Applies files in order and supports --list', async () => {
  const ctx = await setup({
    '001_one.sql': "INSERT INTO tasks (title) VALUES ('one');",
    '002_two.sql': "INSERT INTO tasks (title) VALUES ('two');",
  });

  try {
    assert.equal((await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env)).code, 0);

    let result = await runCli(['seed', '--list', '--dir', ctx.fixture.root], ctx.env, {
      omitEnv: databaseEnvKeys,
    });
    assert.equal(result.code, 0, plain(result.stderr));
    assert.match(plain(result.stdout), /001_one\.sql/);
    assert.match(plain(result.stdout), /002_two\.sql/);

    result = await runCli(['seed', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 0, plain(result.stderr));
    assert.equal(await countTasks(ctx.database), 2);
  } finally {
    await ctx.cleanup();
  }
});

test('Rolls back a file that fails halfway', async () => {
  const ctx = await setup({
    '001_ok.sql': "INSERT INTO tasks (title) VALUES ('kept');",
    '002_broken.sql': [
      "INSERT INTO tasks (title) VALUES ('rolled back');",
      'INSERT INTO missing_table (id) VALUES (1);',
    ].join('\n'),
  });

  try {
    assert.equal((await runCli(['migrate', 'up', '--dir', ctx.fixture.root], ctx.env)).code, 0);

    const result = await runCli(['seed', '--dir', ctx.fixture.root], ctx.env);
    assert.equal(result.code, 1);
    assert.match(plain(result.stderr), /missing_table/);
    assert.equal(await countTasks(ctx.database), 1);

    const connection = await ctx.database.connect();
    const [rows] = await connection.query('SELECT title FROM tasks');
    await connection.end();
    assert.deepEqual(
      rows.map((row) => row.title),
      ['kept'],
    );
  } finally {
    await ctx.cleanup();
  }
});
