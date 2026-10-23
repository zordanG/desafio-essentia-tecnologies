import { createInterface } from 'node:readline/promises';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { C } from '../colors.js';
import { getCliEnv, getDbEnv, loadServiceEnv } from '../config/env.js';
import { connect, getConnectionConfig, withLock, CONTROL_TABLE } from './client.js';
import { loadConfig } from './config.js';
import { ensureControlTable, up } from './migrate.js';
import { applySeeds } from './seed.js';

function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

async function listBaseTables(client: Connection): Promise<string[]> {
  const [rows] = await client.query<RowDataPacket[]>(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME != ?
      ORDER BY TABLE_NAME`,
    [CONTROL_TABLE],
  );

  return rows.map((row) => row.TABLE_NAME as string);
}

export async function run(argv: string[]): Promise<void> {
  const opts = {
    yes: false,
    seed: false,
    migrations: true,
    dryRun: false,
    force: false,
    allTables: false,
  };
  let dir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === '-y' || a === '--yes') opts.yes = true;
    else if (a === '--seed') opts.seed = true;
    else if (a === '--no-migrations') opts.migrations = false;
    else if (a === '--all-tables') opts.allTables = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--dir') dir = argv[++i];
    else {
      console.error(
        'usage: dbmigrate reset [--dir <root>] [--seed] [--no-migrations] [--all-tables] [--yes] [--force] [--dry-run]',
      );
      process.exitCode = 2;
      return;
    }
  }

  const cfg = loadConfig(dir);
  loadServiceEnv(cfg.root);

  if (getCliEnv().NODE_ENV === 'production' && !opts.force) {
    console.error(
      `${C.red}Refusing to reset with NODE_ENV=production (use --force if intentional)${C.reset}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!opts.allTables && cfg.ownedTables.length === 0) {
    console.error(
      `${C.red}Refusing to reset: db-tools.json must define "ownedTables" (or use --all-tables)${C.reset}`,
    );
    process.exitCode = 1;
    return;
  }

  const dbEnv = getDbEnv();
  const { host, database } = getConnectionConfig(dbEnv);

  console.log(`${C.yellow}Service:${C.reset} ${cfg.service}`);
  console.log(`${C.yellow}Host:${C.reset} ${host}`);
  console.log(`${C.yellow}Database:${C.reset} ${database}`);
  console.log(
    `${C.yellow}Tables:${C.reset} ${
      opts.allTables
        ? `${C.red}ALL BASE TABLES${C.reset} (except ${CONTROL_TABLE})`
        : cfg.ownedTables.join(', ')
    }`,
  );
  console.log(
    `Then: ${opts.migrations ? 'migrations (up)' : 'no migrations'}${opts.seed ? ' + seeds' : ''}`,
  );

  if (opts.dryRun) {
    console.log(`${C.dim}--dry-run: nothing was executed${C.reset}`);
    return;
  }

  if (!opts.yes) {
    if (!process.stdin.isTTY) {
      console.error(`${C.red}Use --yes to confirm (non-interactive stdin)${C.reset}`);
      process.exitCode = 2;
      return;
    }

    const target = opts.allTables
      ? 'ALL base tables'
      : `the owned tables (${cfg.ownedTables.join(', ')})`;

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (
      await rl.question(
        `${C.red}This WIPES ${target} in database "${database}". Type "${database}" to confirm: ${C.reset}`,
      )
    ).trim();
    rl.close();

    if (answer !== database) {
      console.log('aborted.');
      process.exitCode = 1;
      return;
    }
  }

  const client = await connect(dbEnv);

  try {
    await withLock(client, cfg.service, async () => {
      await ensureControlTable(client, cfg.service);

      const existing = await listBaseTables(client);
      const owned = new Set(cfg.ownedTables.filter((table) => table !== CONTROL_TABLE));
      const toDrop = opts.allTables ? existing : [...owned];

      await client.query('SET FOREIGN_KEY_CHECKS = 0');

      try {
        for (const table of toDrop) {
          await client.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);

          if (existing.includes(table)) {
            console.log(`${C.green}Dropped${C.reset} ${table}`);
          }
        }
      } finally {
        await client.query('SET FOREIGN_KEY_CHECKS = 1');
      }

      await client.query(`DELETE FROM ${CONTROL_TABLE} WHERE service = ?`, [cfg.service]);
      console.log(`${C.green}Cleared${C.reset} control records for service ${cfg.service}`);

      if (opts.migrations) {
        console.log(`\n${C.cyan}Migrations${C.reset}`);
        await up(client, cfg, {});
      }

      if (opts.seed) {
        console.log(`\n${C.cyan}Seeds${C.reset}`);
        await applySeeds(client, cfg, {});
      }

      if (!opts.allTables) {
        const remaining = await listBaseTables(client);
        const undeclared = remaining.filter((table) => !owned.has(table));

        if (undeclared.length > 0) {
          console.log(
            `\n${C.yellow}Warning:${C.reset} tables not declared in "ownedTables" were left untouched: ${undeclared.join(', ')}`,
          );
        }
      }
    });
  } finally {
    await client.end();
  }

  console.log(`\n${C.green}reset complete.${C.reset}`);
}
