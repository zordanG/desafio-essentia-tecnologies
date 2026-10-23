# API database

MySQL 8.4 runs in the `desafio-mysql` container described by `docker-compose.yml`.
The `@repo/db-tools` workspace applies migrations, seeds and resets; there is no
separate migration library.

## Layout

```
apps/api/
  db-tools.json
  db/
    migrations/
      up/    # applied in version order (filename prefix)
      down/  # rolls back the matching version
    seeds/   # optional data scripts, applied in filename order
```

`db-tools.json` selects the service name (`api`), the migrations directory, the
seeds directory and the tables owned by the service. The `schema_migrations`
table records the applied versions, their checksums, status and timestamps.
Records are isolated by `service`, so several services can share the same
database.

```json
{
  "service": "api",
  "migrations": "db/migrations",
  "seeds": "db/seeds",
  "ownedTables": ["tasks"]
}
```

`ownedTables` is the MySQL equivalent of the Postgres schema scope: `reset` only
drops these tables unless `--all-tables` is passed. Keep the list in sync when a
migration creates or renames a table; undeclared tables are reported and left
untouched.

Each service keeps its own `db-tools.json` and `db/` directory. A future service
adds `apps/<service>/db-tools.json` with a unique `service` and its own
`ownedTables`, then runs the CLI with `--dir apps/<service>`. Do not add another
service as an extra key in this file.

## Environment

The configuration is the repository root `.env`. The CLI loads that file;
variables already present in the process win. It uses the same
`@repo/config-env` validation as the API, but validates the database
variables only when a command needs a connection. `seed --list` works without
credentials.

| Variable         | Required when connecting | Default      |
| ---------------- | ------------------------ | ------------ |
| `MYSQL_HOST`     | Yes                      | -            |
| `MYSQL_PORT`     | No                       | `3306`       |
| `MYSQL_USER`     | Yes                      | -            |
| `MYSQL_PASSWORD` | Yes                      | -            |
| `MYSQL_DATABASE` | Yes                      | -            |
| `NODE_ENV`       | No                       | `production` |

`NODE_ENV=production` blocks `reset` unless `--force` is passed. The integration
tests additionally read `MYSQL_ROOT_PASSWORD` from the root `.env`.

Migration filenames must follow `<YYYYMMDDHHmmss>_<name>.sql`, for example
`20261023000000_tasks.sql`. The timestamp is the version and must be unique.

## Commands

Run from the repository root. The migration, seed and reset scripts build the
CLI before running and target `apps/api` with `--dir`. The `db:up`, `db:down`
and `db:logs` scripts only forward to Docker Compose.

| Command                            | Description                                                      |
| ---------------------------------- | ---------------------------------------------------------------- |
| `npm run db:up`                    | Starts the MySQL container.                                      |
| `npm run db:down`                  | Stops the MySQL container.                                       |
| `npm run db:logs`                  | Follows the MySQL container logs.                                |
| `npm run db:migrate:status`        | Lists migrations and whether each one was applied.               |
| `npm run db:migrate`               | Applies every pending migration.                                 |
| `npm run db:migrate:down`          | Rolls back the last applied migration.                           |
| `npm run db:seed:list`             | Lists the available seed files.                                  |
| `npm run db:seed`                  | Runs every seed file.                                            |
| `npm run db:reset`                 | Drops the owned tables, re-runs migrations and optionally seeds. |
| `npm run db:reset -- --all-tables` | Drops every base table in the database.                          |

Flags are forwarded after `--`. For example:

```bash
npm run db:reset -- --yes --seed
npm run db:migrate -- --steps 1
npm run db:seed -- --file 001_demo
```

For the full flag list, build once and call the CLI directly:

```bash
npm run db:build
node packages/db-tools/dist/cli.js migrate status --dir apps/api
```

## Adding a migration

1. Create `apps/api/db/migrations/up/<version>_<name>.sql`.
2. Create the matching `apps/api/db/migrations/down/<version>_<name>.sql`.
3. Run `npm run db:migrate`.

Use the same version prefix (for example `20261023000000`) for the `up` and
`down` files. Versions are ordered lexicographically, so keep the prefix fixed
width.

Before applying anything, the CLI:

- rejects filenames outside `<YYYYMMDDHHmmss>_<name>.sql`;
- rejects duplicate versions in the same directory;
- warns when an `up` file has no `down` counterpart, when a `down` file has no
  `up` counterpart, or when the two names differ.

The `down` file is recommended but not mandatory: irreversible migrations can
omit it. In that case `db:migrate:down` cannot roll them back.

MySQL commits DDL implicitly, so a migration that fails halfway can leave the
schema partially changed. To make that visible, the CLI writes the record with
status `running` before executing the SQL, changes it to `applied` on success
and to `failed` on error. An interrupted record appears as `[!]` in
`db:migrate:status`, and `db:migrate` / `db:migrate:down` refuse to continue
while any record is not `applied`. `db:migrate:status` exits with code 1 in that
case.

To recover, inspect the schema and finish or undo the partial change manually,
then either delete the record to retry the migration or set
`status = 'applied'` and `applied_at = CURRENT_TIMESTAMP(3)` if the schema is
correct:

```sql
DELETE FROM schema_migrations WHERE service = 'api' AND version = '<version>';
```

Migrations, seeds and reset take a MySQL advisory lock (`GET_LOCK`) scoped to the
service, so two CLI processes cannot modify the same database at the same time.
This does not protect against other clients; always inspect the interrupted
state before retrying.

Applied migrations are checksummed. Editing a file after it was applied makes
`db:migrate` abort; add a new migration instead of changing history. To recover
from an intentional edit in development, roll it back (`db:migrate:down`) and
apply it again.

## Seeds

Seeds are plain SQL files and are executed in filename order. They are not
tracked, so running `db:seed` twice runs them twice: write idempotent scripts
(`INSERT ... ON DUPLICATE KEY UPDATE`) or reset the database first. A typical
development flow is:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
```

## Reset

`db:reset` drops only the tables listed in `ownedTables`, clears the control
records for the current service, and re-runs migrations (and seeds with
`--seed`). `--all-tables` switches to dropping every base table in the database
except `schema_migrations`; it is meant for throwaway databases and shared
services, not for the normal development flow.

The command prints the target service, host, database and table scope. It
refuses to run when `NODE_ENV=production` unless `--force` is passed, and unless
`--yes` is passed it asks you to type the database name to confirm. With
non-interactive stdin, use `--yes`.

After the reset, any table that exists but is not listed in `ownedTables` is
reported and left untouched. This catches a migration that created a table
without updating `db-tools.json`.

Use one database per service when possible. `--all-tables` is database-wide and
can remove tables owned by other services.

## Tests

The db-tools integration tests use a real MySQL server. Start the container, then
run:

```bash
npm test
# or only this workspace:
npm test -w @repo/db-tools
```

The tests use `MYSQL_ROOT_PASSWORD` from the root `.env`, create a random
database per test file, and drop it afterwards. They never connect to the
database configured for development. The API tests apply the migrations from
`apps/api/db/migrations/up`. The lock test waits for the 10-second `GET_LOCK`
timeout, so the suite takes a little longer.
