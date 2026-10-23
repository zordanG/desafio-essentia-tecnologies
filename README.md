# TechX Tasks

Full-stack task management application built for the Essentia Technologies
challenge. The repository is a Turborepo monorepo with a Fastify/MySQL API and
an Angular frontend.

## Stack

| Layer    | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Web      | Angular 22 standalone, zoneless, Angular Material 22, Vitest |
| API      | Fastify 5, Zod, mysql2, Swagger/OpenAPI, Helmet, CORS        |
| Database | MySQL 8.4 running in Docker                                  |
| Tooling  | Turborepo, TypeScript 6, ESLint, Prettier, npm workspaces    |

## Architecture

```text
Browser
  |
  |  config.json (runtime API base URL)
  v
Angular web :3000
  |
  |  HTTP /todos
  v
Fastify API :3001
  |
  |  mysql2 pool
  v
MySQL 8.4 :3306
```

The API serves the CRUD contract, validates input with Zod and keeps database
access behind transactions where a write spans more than one statement. The web
app loads its API URL at runtime, so the same production build can be promoted
between environments.

## Repository layout

```text
apps/
  api/                    Fastify HTTP API, migrations and seeds
  web/                    Angular task board
packages/
  config-env/             Shared dotenv + Zod environment validation
  db-tools/               Migration, seed and reset CLI
  eslint-config/          Shared ESLint flat config
  logger/                 Structured JSON logger
  typescript-config/      Shared TypeScript configurations
docker-compose.yml        Local MySQL 8.4 service
turbo.json                Turborepo task graph
.env.example              Environment variable template
```

Detailed documentation:

- [API](apps/api/README.md)
- [Web](apps/web/README.md)
- [Database and migrations](apps/api/db/README.md)
- [Seeds](apps/api/db/seeds/README.md)

## Requirements

- Node.js >= 24
- npm >= 11.20
- Docker Engine or Docker Desktop with Docker Compose
- Ports `3000`, `3001` and `3306` available

The Angular CLI and TypeScript are installed through the workspace; no global
installation is required.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

The repository uses one root `.env` for the API, database tooling and Docker
Compose. Copy the template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The template is already configured for local development. Keep the database name
as `desafio` unless you also update every related configuration.

`node_modules`, `dist` and `.env` are gitignored. Never commit them.

### 3. Start MySQL

```bash
npm run db:up
```

The container is named `desafio-mysql`. Wait until Docker Compose reports it as
healthy:

```bash
docker compose ps
```

### 4. Apply migrations

```bash
npm run db:migrate
```

The current schema creates the `tasks` table. Seeds are optional and the
`apps/api/db/seeds` directory contains no SQL files by default.

### 5. Start the applications

```bash
npm run dev
```

Turborepo starts the API and the web app together.

| Service      | URL                            |
| ------------ | ------------------------------ |
| Web          | `http://localhost:3000`        |
| API          | `http://localhost:3001`        |
| Health check | `http://localhost:3001/health` |
| Swagger UI   | `http://localhost:3001/docs`   |
| MySQL (host) | `localhost:3306`               |

Swagger UI is available only when the API runs with `NODE_ENV` other than
`production`.

## Environment variables

The API reads the root `.env` and validates it before starting. The database CLI
uses the same file. The web app does **not** read `.env`; its API URL comes from
a public runtime file.

| Variable              | Required     | Default      | Purpose                                                           |
| --------------------- | ------------ | ------------ | ----------------------------------------------------------------- |
| `NODE_ENV`            | No           | `production` | `development`, `test` or `production`.                            |
| `LOG_LEVEL`           | No           | `info`       | Minimum log level: `debug`, `info`, `warn` or `error`.            |
| `PORT`                | No           | `3001`       | API HTTP port.                                                    |
| `HOST`                | Yes          | -            | API bind address. Use `0.0.0.0` to accept external connections.   |
| `ALLOWED_ORIGINS`     | Yes          | -            | Comma-separated CORS origins.                                     |
| `MYSQL_HOST`          | Yes          | -            | MySQL host. Use `localhost` when the API runs outside Docker.     |
| `MYSQL_PORT`          | No           | `3306`       | MySQL port the API connects to; Compose publishes it locally.     |
| `MYSQL_USER`          | Yes          | -            | Application database user.                                        |
| `MYSQL_PASSWORD`      | Yes          | -            | Application database password.                                    |
| `MYSQL_DATABASE`      | Yes          | -            | Database name. The development template uses `desafio`.           |
| `MYSQL_ROOT_PASSWORD` | Docker/tests | -            | Container administrator password; also used by integration tests. |

`NODE_ENV` defaults to `production` so a deployment that forgets to set it does
not expose Swagger UI or stack traces. Locally, use `NODE_ENV=development` as
`.env.example` does.

## Root scripts

| Command                     | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| `npm run dev`               | Starts the API and web app in watch mode.                   |
| `npm run build`             | Builds every workspace with a build task.                   |
| `npm run lint`              | Runs ESLint across the monorepo.                            |
| `npm run check-types`       | Runs TypeScript checks across the monorepo.                 |
| `npm run format`            | Formats source, HTML, CSS, Markdown and YAML with Prettier. |
| `npm test`                  | Runs the test suite. Requires MySQL and the root `.env`.    |
| `npm run db:build`          | Compiles the `@repo/db-tools` CLI.                          |
| `npm run db:up`             | Starts the MySQL container.                                 |
| `npm run db:down`           | Stops the MySQL container.                                  |
| `npm run db:logs`           | Follows the MySQL container logs.                           |
| `npm run db:migrate`        | Applies pending migrations.                                 |
| `npm run db:migrate:status` | Lists migrations and their state.                           |
| `npm run db:migrate:down`   | Rolls back the latest migration.                            |
| `npm run db:reset`          | Drops and recreates the API-owned tables.                   |
| `npm run db:seed`           | Runs the available seed files.                              |
| `npm run db:seed:list`      | Lists the available seed files.                             |

The migration, seed and reset scripts build `@repo/db-tools` before running and
target `apps/api`. Flags are forwarded after `--`, for example:

```bash
npm run db:reset -- --yes --seed
npm run db:migrate -- --steps 1
```

## API

| Method   | Path         | Result                         |
| -------- | ------------ | ------------------------------ |
| `GET`    | `/health`    | `{ "status": "ok" }`           |
| `GET`    | `/docs`      | Swagger UI, development only.  |
| `GET`    | `/todos`     | Lists tasks, newest first.     |
| `POST`   | `/todos`     | Creates a task, returns `201`. |
| `GET`    | `/todos/:id` | Returns one task.              |
| `PATCH`  | `/todos/:id` | Updates a task.                |
| `DELETE` | `/todos/:id` | Deletes a task, returns `204`. |

Errors use one shape:

```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Task not found",
  "status": 404
}
```

Validation failures return `400 VALIDATION_ERROR`; unknown routes return
`404 RESOURCE_NOT_FOUND`; unexpected failures return `500 INTERNAL_ERROR`
without leaking stack traces or original error messages.

## Web

The board lists tasks, creates and edits them through Material dialogs, confirms
deletions, toggles completion inline and refreshes the list from the API. It also
handles loading, empty and error states, keeps the affected controls disabled
while a request is in flight and supports light and dark themes.

The application is a single screen; Angular Router is not used. Updates are not
optimistic: the board waits for the API and replaces the task with the response.

### Runtime configuration

The API base URL is not compiled into the bundle. The web app loads
`config.json` from its public root during startup, before the board renders. The
local template is:

```json
{
  "apiBaseUrl": "http://localhost:3001"
}
```

For a deployment, replace the `config.json` published next to `index.html`:

```bash
npm run build -w web
API_BASE_URL=https://api.example.com npm run runtime-config -w web
```

On Windows PowerShell:

```powershell
npm run build -w web
$env:API_BASE_URL = 'https://api.example.com'
npm run runtime-config -w web
```

The script writes `dist/web/browser/config.json` using the shared
`@repo/config-env` validation. It reads `API_BASE_URL` from the process
environment, not from the root `.env`. The value must be an absolute HTTP(S) URL
or a path starting with `/`. `NODE_ENV` defaults to `production`; the script
rejects localhost in that mode.

Deployment requirements:

- Serve `config.json` with `Cache-Control: no-cache` so a new deployment is not
  hidden by a stale cache.
- Add the deployed web origin to the API `ALLOWED_ORIGINS` list when the web app
  and API use different origins.
- Treat `config.json` as public. It must never contain secrets.

> If the production `config.json` is not replaced, each browser will try to reach
> its own `http://localhost:3001`.

See the [web README](apps/web/README.md) for the full frontend documentation.

## Database

The `tasks` table stores:

| Column        | Type            |
| ------------- | --------------- |
| `id`          | `CHAR(36)` UUID |
| `title`       | `VARCHAR(255)`  |
| `description` | `TEXT NULL`     |
| `completed`   | `BOOLEAN`       |
| `created_at`  | `DATETIME(3)`   |
| `updated_at`  | `DATETIME(3)`   |

Migrations live in `apps/api/db/migrations/{up,down}` and follow
`<YYYYMMDDHHmmss>_<name>.sql`. Applied migrations are checksummed; never edit an
applied migration, add a new one instead. Seeds are plain SQL files and are not
tracked by the migration table, so they must be idempotent.

`npm run db:reset -- --yes --seed` drops the API-owned tables, re-applies the
migrations and runs the seeds. It is destructive; use it only against
development data.

See the [database README](apps/api/db/README.md) for the full migration, seed,
reset and recovery reference.

## Tests

The web tests use Vitest with jsdom. The API and db-tools tests use the Node.js
test runner and a real MySQL server.

Start MySQL and create the root `.env` before running the full suite:

```bash
npm test
```

Run a single workspace:

```bash
npm test -w web
npm test -w api
npm test -w @repo/db-tools
```

The API tests create a temporary database from the migrations and drop it
afterwards. The db-tools tests create random databases per test file. They never
connect to the development database.

Quality gates:

```bash
npm run lint
npm run check-types
npm run build
```

## Deployment

The Compose file in this repository starts MySQL for local development. A
production deployment must provide its own MySQL instance and inject the server
environment through the platform's secret/configuration mechanism.

Recommended release steps:

1. Set the API environment, including `NODE_ENV=production`, database
   credentials and `ALLOWED_ORIGINS`.
2. Run `npm run db:migrate` against the target database before starting the API.
3. Build the server:

   ```bash
   npm run build -w api
   ```

4. Start the compiled server from `apps/api/dist` with the environment above:

   ```bash
   npm run start -w api
   ```

5. Build the web app and generate its runtime configuration:

   ```bash
   npm run build -w web
   API_BASE_URL=https://api.example.com npm run runtime-config -w web
   ```

6. Publish `apps/web/dist/web/browser` and serve `config.json` with
   `Cache-Control: no-cache`.
7. Verify `GET /health` and the web task board before routing production
   traffic.

A CI pipeline should run:

```bash
npm ci
npm run lint
npm run check-types
npm test
npm run build
```

The test job needs a MySQL 8.4 service and the same database variables used by
the root `.env`. The web build artifact is not ready for a remote API until its
`config.json` has been generated for the target environment.

## Troubleshooting

- **API exits during startup:** the error lists every invalid or missing
  environment variable. Check the root `.env` and the table above.
- **`npm run db:up` fails:** confirm Docker is running and port `3306` is free.
  If another MySQL instance uses the port, change `MYSQL_PORT`.
- **Database commands cannot connect:** the container may still be starting.
  Check `docker compose ps` or `npm run db:logs`.
- **Web calls localhost after deployment:** replace `dist/web/browser/config.json`
  and invalidate its cache.
- **CORS errors in the browser:** add the web origin to `ALLOWED_ORIGINS` and
  restart the API.
- **`db:reset` refuses to run:** it requires `--yes` for non-interactive use and
  `--force` when `NODE_ENV=production`.
- **Tests fail before running:** start MySQL and make sure
  `MYSQL_ROOT_PASSWORD` is available in the root `.env`.

## Design decisions

- Turborepo keeps the API, web app and shared packages in one workspace while
  preserving independent build and test commands.
- Server secrets stay out of the browser. Locally they live in the root `.env`;
  deployments inject them through the platform.
- The web app uses a public runtime `config.json` instead of build-time
  environment replacement, so one build can be promoted across environments.
- Database changes use the repository's `@repo/db-tools` CLI and versioned SQL
  migrations instead of a separate migration library.
- Writes are not optimistic. The UI reflects the API response, which keeps the
  board predictable and easier to test.
- The current scope is a single-user board; authentication and multi-tenancy are
  not implemented.
