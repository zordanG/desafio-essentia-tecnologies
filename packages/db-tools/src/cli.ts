#!/usr/bin/env node
import { C } from './colors.js';
import * as migrate from './db/migrate.js';
import * as seed from './db/seed.js';
import * as reset from './db/reset.js';

const USAGE = `usage:
  dbmigrate migrate <up|down|status> [--dir <root>] [--steps N] [--to <version>] [--dry-run]
  dbmigrate seed [--dir <root>] [--file <name>] [--list] [--dry-run]
  dbmigrate reset [--dir <root>] [--seed] [--no-migrations] [--all-tables] [--yes] [--force] [--dry-run]`;

export async function main(argv: string[]): Promise<void> {
  const [group, command, ...rest] = argv;

  if (!group || ['help', '--help', '-h'].includes(group)) {
    console.log(USAGE);
    return;
  }

  if (group === 'db') {
    if (command === 'migrate') return migrate.run(rest);
    if (command === 'seed') return seed.run(rest);
    if (command === 'reset') return reset.run(rest);
  }

  const args = command === undefined ? [] : [command, ...rest];

  if (group === 'migrate') return migrate.run(args);
  if (group === 'seed') return seed.run(args);
  if (group === 'reset') return reset.run(args);

  console.error(`${C.red}Unrecognized command:${C.reset} ${argv.join(' ')}`);
  console.log(USAGE);
  process.exitCode = 2;
}

main(process.argv.slice(2)).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n${C.red}Error:${C.reset} ${message}\n`);
  process.exit(1);
});
