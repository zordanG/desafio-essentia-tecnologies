import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../dist/db/config.js';
import { loadMigrations } from '../dist/db/migrate.js';
import { makeFixture } from '../test-support/helpers.mjs';

test('Loads ownedTables from the config', async () => {
  const fixture = await makeFixture({ service: 'api', ownedTables: ['tasks'] });

  try {
    const config = loadConfig(fixture.root);

    assert.deepEqual(config.ownedTables, ['tasks']);
    assert.equal(config.service, 'api');
  } finally {
    await fixture.cleanup();
  }
});

test('Defaults ownedTables to an empty list', async () => {
  const fixture = await makeFixture({});

  try {
    assert.deepEqual(loadConfig(fixture.root).ownedTables, []);
  } finally {
    await fixture.cleanup();
  }
});

test('Rejects invalid ownedTables entries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'db-tools-config-'));

  try {
    const invalid = [
      { service: 'api', ownedTables: 'tasks' },
      { service: 'api', ownedTables: ['tasks', ''] },
      { service: 'api', ownedTables: ['tasks', 1] },
    ];

    for (const config of invalid) {
      await writeFile(path.join(root, 'db-tools.json'), JSON.stringify(config));
      assert.throws(() => loadConfig(root), /"ownedTables" must be an array of non-empty strings/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Rejects invalid migration filenames', async () => {
  const fixture = await makeFixture({ up: { 'bad.sql': 'SELECT 1;' } });

  try {
    await assert.rejects(
      loadMigrations(path.join(fixture.root, 'db/migrations/up')),
      /invalid migration filename "bad.sql"/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('Rejects duplicate migration versions', async () => {
  const fixture = await makeFixture({
    up: {
      '20260101000000_first.sql': 'SELECT 1;',
      '20260101000000_second.sql': 'SELECT 2;',
    },
  });

  try {
    await assert.rejects(
      loadMigrations(path.join(fixture.root, 'db/migrations/up')),
      /duplicate migration version 20260101000000/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('Sorts migrations by version', async () => {
  const fixture = await makeFixture({
    up: {
      '20260102000000_second.sql': 'SELECT 2;',
      '20260101000000_first.sql': 'SELECT 1;',
    },
  });

  try {
    const migrations = await loadMigrations(path.join(fixture.root, 'db/migrations/up'));

    assert.deepEqual(
      migrations.map((migration) => migration.version),
      ['20260101000000', '20260102000000'],
    );
  } finally {
    await fixture.cleanup();
  }
});
