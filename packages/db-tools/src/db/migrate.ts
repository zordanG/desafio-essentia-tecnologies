import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { C } from '../colors.js';
import { getDbEnv, loadServiceEnv } from '../config/env.js';
import { connect, withLock, CONTROL_TABLE } from './client.js';
import { loadConfig, type DbConfig } from './config.js';

export type Migration = {
  version: string;
  name: string;
  file: string;
  sql: string;
  checksum: string;
};

export type MigrateOptions = {
  dryRun?: boolean;
  steps?: number;
  to?: string;
};

type MigrationStatus = 'applied' | 'running' | 'failed' | 'reverting';

type AppliedRow = {
  version: string;
  name: string;
  checksum: string;
  status: MigrationStatus;
  applied_at: Date | null;
};

type MigrationSet = {
  up: Migration[];
  down: Migration[];
};

type ColumnRow = RowDataPacket & {
  COLUMN_NAME: string;
  IS_NULLABLE: 'YES' | 'NO';
};

const MIGRATION_FILE = /^(\d{14})_(.+)\.sql$/;

function hash(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export async function loadMigrations(dir: string): Promise<Migration[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const list = await Promise.all(
    files
      .filter((file) => file.endsWith('.sql'))
      .map(async (file): Promise<Migration> => {
        const match = MIGRATION_FILE.exec(file);
        const version = match?.[1];
        const name = match?.[2];

        if (!version || !name) {
          throw new Error(
            `invalid migration filename "${file}" (expected <YYYYMMDDHHmmss>_<name>.sql)`,
          );
        }

        const sql = await readFile(path.join(dir, file), 'utf8');

        return {
          version,
          name,
          file,
          sql,
          checksum: hash(sql),
        };
      }),
  );

  const sorted = list.sort((a, b) => a.version.localeCompare(b.version));
  const seen = new Map<string, string>();

  for (const migration of sorted) {
    const previous = seen.get(migration.version);

    if (previous) {
      throw new Error(
        `duplicate migration version ${migration.version}: "${previous}" and "${migration.file}"`,
      );
    }

    seen.set(migration.version, migration.file);
  }

  return sorted;
}

/** Loads both migration directions and reports files that do not form a pair. */
export async function loadMigrationSet(cfg: DbConfig): Promise<MigrationSet> {
  const up = await loadMigrations(cfg.upDir);
  const down = await loadMigrations(cfg.downDir);
  const downByVersion = new Map(down.map((migration) => [migration.version, migration]));

  for (const migration of up) {
    const counterpart = downByVersion.get(migration.version);

    if (!counterpart) {
      console.log(
        `${C.yellow}Warning:${C.reset} ${migration.version}_${migration.name} has no down/ file`,
      );
      continue;
    }

    downByVersion.delete(migration.version);

    if (counterpart.name !== migration.name) {
      console.log(
        `${C.yellow}Warning:${C.reset} ${migration.version}: up name "${migration.name}" differs from down name "${counterpart.name}"`,
      );
    }
  }

  for (const migration of downByVersion.values()) {
    console.log(
      `${C.yellow}Warning:${C.reset} ${migration.version}_${migration.name} has no up/ file`,
    );
  }

  return { up, down };
}

export async function ensureControlTable(client: Connection, service: string): Promise<void> {
  const [rows] = await client.query<ColumnRow[]>(
    `SELECT COLUMN_NAME, IS_NULLABLE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [CONTROL_TABLE],
  );

  if (rows.length === 0) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${CONTROL_TABLE} (
        service    VARCHAR(64) NOT NULL,
        version    VARCHAR(64) NOT NULL,
        name       VARCHAR(255) NOT NULL,
        checksum   CHAR(64) NOT NULL,
        status     VARCHAR(16) NOT NULL DEFAULT 'applied',
        applied_at DATETIME(3) NULL DEFAULT NULL,
        PRIMARY KEY (service, version)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
    `);

    return;
  }

  let changed = false;

  const hasService = rows.some((row) => row.COLUMN_NAME === 'service');

  if (!hasService) {
    await client.query(`ALTER TABLE ${CONTROL_TABLE} ADD COLUMN service VARCHAR(64)`);
    await client.query(`UPDATE ${CONTROL_TABLE} SET service = ? WHERE service IS NULL`, [service]);
    await client.query(`ALTER TABLE ${CONTROL_TABLE} MODIFY service VARCHAR(64) NOT NULL`);
    await client.query(`ALTER TABLE ${CONTROL_TABLE} DROP PRIMARY KEY`);
    await client.query(`ALTER TABLE ${CONTROL_TABLE} ADD PRIMARY KEY (service, version)`);
    changed = true;
  }

  const hasStatus = rows.some((row) => row.COLUMN_NAME === 'status');

  if (!hasStatus) {
    await client.query(
      `ALTER TABLE ${CONTROL_TABLE} ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'applied'`,
    );
    changed = true;
  }

  const appliedAt = rows.find((row) => row.COLUMN_NAME === 'applied_at');

  if (appliedAt?.IS_NULLABLE === 'NO') {
    await client.query(
      `ALTER TABLE ${CONTROL_TABLE} MODIFY applied_at DATETIME(3) NULL DEFAULT NULL`,
    );
    changed = true;
  }

  if (changed) {
    console.log(`${C.yellow}Upgraded ${CONTROL_TABLE} to the current format${C.reset}`);
  }
}

async function getApplied(client: Connection, service: string): Promise<AppliedRow[]> {
  const [rows] = await client.query<RowDataPacket[]>(
    `SELECT version, name, checksum, status, applied_at
       FROM ${CONTROL_TABLE}
      WHERE service = ?
      ORDER BY version ASC`,
    [service],
  );

  return rows as AppliedRow[];
}

function checkChecksums(applied: AppliedRow[], up: Migration[]): boolean {
  const byVersion = new Map(up.map((migration) => [migration.version, migration]));
  let ok = true;

  for (const row of applied) {
    const migration = byVersion.get(row.version);

    if (!migration) {
      console.log(
        `${C.yellow}Warning:${C.reset} ${row.version}_${row.name} was applied, but the up/ file is missing`,
      );
      ok = false;
      continue;
    }

    if (migration.checksum !== row.checksum) {
      console.log(
        `${C.red}Error:${C.reset} ${row.version}_${row.name}: checksum mismatch (file changed after being applied)`,
      );
      ok = false;
    }
  }

  return ok;
}

function assertCleanState(applied: AppliedRow[]): void {
  const broken = applied.filter((row) => row.status !== 'applied');

  if (broken.length === 0) return;

  const list = broken.map((row) => `${row.version}_${row.name} (${row.status})`).join(', ');

  throw new Error(
    `migration state is not clean: ${list}. Fix the database manually, then delete the record(s) or set status = 'applied'.`,
  );
}

async function applyUp(client: Connection, migration: Migration, service: string): Promise<void> {
  // Record the attempt before running the DDL. MySQL commits DDL implicitly, so
  // a failure halfway must leave a visible record instead of looking pending.
  await client.query(
    `INSERT INTO ${CONTROL_TABLE} (service, version, name, checksum, status, applied_at)
     VALUES (?, ?, ?, ?, 'running', NULL)`,
    [service, migration.version, migration.name, migration.checksum],
  );

  try {
    await client.query(migration.sql);

    await client.query(
      `UPDATE ${CONTROL_TABLE}
          SET status = 'applied', applied_at = CURRENT_TIMESTAMP(3)
        WHERE service = ? AND version = ?`,
      [service, migration.version],
    );
  } catch (error) {
    await client
      .query(`UPDATE ${CONTROL_TABLE} SET status = 'failed' WHERE service = ? AND version = ?`, [
        service,
        migration.version,
      ])
      .catch(() => undefined);

    throw error;
  }
}

async function applyDown(
  client: Connection,
  row: AppliedRow,
  migration: Migration,
  service: string,
): Promise<void> {
  await client.query(
    `UPDATE ${CONTROL_TABLE} SET status = 'reverting' WHERE service = ? AND version = ?`,
    [service, row.version],
  );

  try {
    await client.query(migration.sql);

    await client.query(`DELETE FROM ${CONTROL_TABLE} WHERE service = ? AND version = ?`, [
      service,
      row.version,
    ]);
  } catch (error) {
    await client
      .query(`UPDATE ${CONTROL_TABLE} SET status = 'failed' WHERE service = ? AND version = ?`, [
        service,
        row.version,
      ])
      .catch(() => undefined);

    throw error;
  }
}

function migrationError(direction: 'up' | 'down', migration: Migration, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  return new Error(
    `migration ${migration.version}_${migration.name} (${direction}) failed: ${message}. It is recorded as failed; inspect the schema before retrying.`,
    { cause: error },
  );
}

export async function up(
  client: Connection,
  cfg: DbConfig,
  opts: MigrateOptions = {},
): Promise<void> {
  const { up: upMigrations } = await loadMigrationSet(cfg);
  const applied = await getApplied(client, cfg.service);

  if (!checkChecksums(applied, upMigrations)) {
    throw new Error('migration record is inconsistent (checksum). Aborting.');
  }

  assertCleanState(applied);

  const appliedVersions = new Set(applied.map((row) => row.version));
  let pending = upMigrations.filter((migration) => !appliedVersions.has(migration.version));

  if (opts.to) pending = pending.filter((migration) => migration.version <= opts.to!);
  if (opts.steps !== undefined) pending = pending.slice(0, opts.steps);

  if (pending.length === 0) {
    console.log('Nothing to apply. Everything is up to date.');
    return;
  }

  console.log(`Pending (${pending.length}):`);

  for (const migration of pending) {
    console.log(`  ${C.cyan}+${C.reset} ${migration.version}_${migration.name}`);
  }

  if (opts.dryRun) {
    console.log(`${C.dim}--dry-run: nothing was executed${C.reset}`);
    return;
  }

  for (const migration of pending) {
    try {
      await applyUp(client, migration, cfg.service);
    } catch (error) {
      throw migrationError('up', migration, error);
    }

    console.log(`${C.green}Applied${C.reset} ${migration.version}_${migration.name}`);
  }
}

export async function down(
  client: Connection,
  cfg: DbConfig,
  opts: MigrateOptions = {},
): Promise<void> {
  const { up: upMigrations, down: downMigrations } = await loadMigrationSet(cfg);
  const downByVersion = new Map(downMigrations.map((migration) => [migration.version, migration]));
  const applied = (await getApplied(client, cfg.service)).sort((a, b) =>
    b.version.localeCompare(a.version),
  );

  if (!checkChecksums(applied, upMigrations)) {
    throw new Error('migration record is inconsistent (checksum). Aborting.');
  }

  assertCleanState(applied);

  let target = applied;
  if (opts.to) target = target.filter((row) => row.version > opts.to!);
  if (opts.steps !== undefined) target = target.slice(0, opts.steps);

  if (target.length === 0) {
    console.log('Nothing to roll back.');
    return;
  }

  console.log(`Rollback (${target.length}):`);

  for (const row of target) {
    console.log(`  ${C.cyan}-${C.reset} ${row.version}_${row.name}`);
  }

  if (opts.dryRun) {
    console.log(`${C.dim}--dry-run: nothing was executed${C.reset}`);
    return;
  }

  for (const row of target) {
    const migration = downByVersion.get(row.version);

    if (!migration) throw new Error(`down/ file missing for ${row.version}_${row.name}`);

    try {
      await applyDown(client, row, migration, cfg.service);
    } catch (error) {
      throw migrationError('down', migration, error);
    }

    console.log(`${C.green}Reverted${C.reset} ${row.version}_${row.name}`);
  }
}

export async function status(client: Connection, cfg: DbConfig): Promise<void> {
  const { up: upMigrations } = await loadMigrationSet(cfg);
  const applied = await getApplied(client, cfg.service);
  const appliedByVersion = new Map(applied.map((row) => [row.version, row]));

  const broken = applied.filter((row) => row.status !== 'applied');

  if (!checkChecksums(applied, upMigrations) || broken.length > 0) {
    process.exitCode = 1;
  }

  console.log('');

  if (upMigrations.length === 0) {
    console.log('(no migrations in up/)');
    return;
  }

  for (const migration of upMigrations) {
    const row = appliedByVersion.get(migration.version);
    const mark = !row
      ? `${C.yellow}[ ]${C.reset}`
      : row.status === 'applied'
        ? `${C.green}[x]${C.reset}`
        : `${C.red}[!]${C.reset}`;

    let suffix = '';

    if (row?.status === 'applied' && row.applied_at) {
      suffix = `${C.dim}(${row.applied_at.toISOString()})${C.reset}`;
    } else if (row) {
      suffix = `${C.dim}(${row.status})${C.reset}`;
    }

    console.log(`  ${mark} ${migration.version}_${migration.name} ${suffix}`);
  }

  if (broken.length > 0) {
    console.log(
      `\n${C.red}Interrupted migrations found.${C.reset} Fix the schema, then delete the record or set status = 'applied'.`,
    );
  }
}

export async function run(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || !['up', 'down', 'status'].includes(command)) {
    console.error(
      'usage: dbmigrate migrate <up|down|status> [--dir <root>] [--steps N] [--to <version>] [--dry-run]',
    );
    process.exitCode = 2;
    return;
  }

  const opts: MigrateOptions = { dryRun: false };
  let dir: string | undefined;

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];

    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--steps') opts.steps = Number(rest[++i]);
    else if (a === '--to') opts.to = rest[++i];
    else if (a === '--dir') dir = rest[++i];
    else {
      console.error(`unknown flag: ${a}`);
      process.exitCode = 2;
      return;
    }
  }

  const cfg = loadConfig(dir);
  loadServiceEnv();
  const client = await connect(getDbEnv());

  try {
    if (command === 'status') {
      await ensureControlTable(client, cfg.service);
      await status(client, cfg);
      return;
    }

    await withLock(client, cfg.service, async () => {
      await ensureControlTable(client, cfg.service);

      if (command === 'up') await up(client, cfg, opts);
      else await down(client, cfg, opts);
    });
  } finally {
    await client.end();
  }
}
