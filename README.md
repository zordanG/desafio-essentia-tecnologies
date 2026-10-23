# TechX Tasks

Full-stack task management application built for the Essentia Technologies challenge. The repository is a Turborepo monorepo with a Fastify/MySQL API and an Angular frontend.

## Stack

| Layer          | Technology                                                   |
| -------------- | ------------------------------------------------------------ |
| Web            | Angular 22 standalone, zoneless, Angular Material 22, Vitest |
| API            | Fastify 5, Zod, mysql2, Swagger/OpenAPI, Helmet, CORS        |
| Database       | MySQL 8.4 running in Docker                                  |
| Authentication | API-managed sessions, Redis-backed session operations        |
| Tooling        | Turborepo, TypeScript 6, ESLint, Prettier, npm workspaces    |

## Architecture

```text
Browser
   |
   | config.json (runtime API base URL)
   v
Angular web :3000
   |
   | HTTP requests
   v
Fastify API :3001
   |                 |
   | MySQL queries   | Authentication / session operations
   v                 v
MySQL 8.4 :3306     Redis :6379
```

The API exposes the task CRUD contract, validates input with Zod, and uses transactions when a write spans multiple statements. Authentication and session operations are handled by the API, with Redis supporting the relevant operations.

The web app loads its API URL at runtime, allowing the same production build to be promoted between environments without rebuilding the frontend.

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
- Ports `3000`, `3001`, and `3306` available

Angular CLI and TypeScript are installed through the workspace; no global installation is required.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

The repository uses a single root `.env` for the API, database tooling, and Docker Compose. The API and database CLI load this file. The web app does **not** read `.env`; its API URL comes from a public runtime configuration file.

Copy the template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The template is configured for local development. Keep the database name as `desafio` unless you update all related configuration.

`node_modules`, `dist`, and `.env` are gitignored. Never commit generated build output or secrets.

### 3. Start MySQL

```bash
npm run db:up
```

The container is named `desafio-mysql`. Wait until Docker Compose reports it as healthy:

```bash
docker compose ps
```

### 4. Apply migrations

```bash
npm run db:migrate
```

The current schema creates the `tasks` table. Seeds are optional; the `apps/api/db/seeds` directory contains no SQL files by default.

### 5. Start the applications

```bash
npm run dev
```

Turborepo starts the API and web app together.

| Service      | URL                                                          |
| ------------ | ------------------------------------------------------------ |
| Web          | [http://localhost:3000](http://localhost:3000)               |
| API          | [http://localhost:3001](http://localhost:3001)               |
| Health check | [http://localhost:3001/health](http://localhost:3001/health) |
| Swagger UI   | [http://localhost:3001/docs](http://localhost:3001/docs)     |
| MySQL (host) | `localhost:3306`                                             |

Swagger UI is available only when the API runs with `NODE_ENV` other than `production`.

## Environment variables

The API validates the root `.env` before starting. The database CLI uses the same file. The web app does **not** read `.env`; it loads its API URL from `config.json`.

| Variable              | Required     | Default      | Purpose                                                           |
| --------------------- | ------------ | ------------ | ----------------------------------------------------------------- |
| `NODE_ENV`            | No           | `production` | Runtime environment: `development`, `test`, or `production`.      |
| `LOG_LEVEL`           | No           | `info`       | Minimum log level: `debug`, `info`, `warn`, or `error`.           |
| `PORT`                | No           | `3001`       | API HTTP port.                                                    |
| `HOST`                | Yes          | —            | API bind address. Use `0.0.0.0` to accept external connections.   |
| `ALLOWED_ORIGINS`     | Yes          | —            | Comma-separated CORS origins.                                     |
| `MYSQL_HOST`          | Yes          | —            | MySQL host. Use `localhost` when the API runs outside Docker.     |
| `MYSQL_PORT`          | No           | `3306`       | MySQL port; Compose publishes it locally.                         |
| `MYSQL_USER`          | Yes          | —            | Application database user.                                        |
| `MYSQL_PASSWORD`      | Yes          | —            | Application database password.                                    |
| `MYSQL_DATABASE`      | Yes          | —            | Database name. The development template uses `desafio`.           |
| `MYSQL_ROOT_PASSWORD` | Docker/tests | —            | Container administrator password; also used by integration tests. |
| `REDIS_HOST`          | Yes          | —            | Redis host. Use `localhost` when the API runs outside Docker.     |
| `REDIS_PORT`          | No           | `6379`       | Redis port.                                                       |
| `REDIS_PASSWORD`      | Yes          | —            | Redis password.                                                   |

`NODE_ENV` defaults to `production` so deployments that omit it do not expose Swagger UI or stack traces. For local development, use `NODE_ENV=development`, as configured in `.env.example`.

## Root scripts

| Command                     | Description                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `npm run dev`               | Starts the API and web app in watch mode.                            |
| `npm run build`             | Builds every workspace with a build task.                            |
| `npm run lint`              | Runs ESLint in workspaces that define a lint task.                   |
| `npm run check-types`       | Runs TypeScript checks in workspaces that define a check-types task. |
| `npm run format`            | Formats source files, HTML, CSS, Markdown, and YAML with Prettier.   |
| `npm test`                  | Runs the test suite. Requires MySQL and the root `.env`.             |
| `npm run db:build`          | Compiles the `@repo/db-tools` CLI.                                   |
| `npm run db:up`             | Starts the MySQL container.                                          |
| `npm run db:down`           | Stops the MySQL container.                                           |
| `npm run db:logs`           | Follows the MySQL container logs.                                    |
| `npm run db:migrate`        | Applies pending migrations.                                          |
| `npm run db:migrate:status` | Lists migrations and their state.                                    |
| `npm run db:migrate:down`   | Rolls back the latest migration.                                     |
| `npm run db:reset`          | Drops and recreates the API-owned tables.                            |
| `npm run db:seed`           | Runs the available seed files.                                       |
| `npm run db:seed:list`      | Lists available seed files.                                          |

Migration, seed, and reset scripts build `@repo/db-tools` before running and target `apps/api`. Flags are forwarded after `--`, for example:

```bash
npm run db:reset -- --yes --seed
npm run db:migrate -- --steps 1
```

## API

| Method   | Path             | Result                                       |
| -------- | ---------------- | -------------------------------------------- |
| `GET`    | `/health`        | Returns `{ "status": "ok" }`.                |
| `GET`    | `/docs`          | Swagger UI, development only.                |
| `GET`    | `/api/todos`     | Lists tasks, newest first.                   |
| `POST`   | `/api/todos`     | Creates a task and returns `201`.            |
| `GET`    | `/api/todos/:id` | Returns one task.                            |
| `PATCH`  | `/api/todos/:id` | Updates a task.                              |
| `DELETE` | `/api/todos/:id` | Deletes a task and returns `204`.            |
| `POST`   | `/auth/register` | Creates an account and starts a session.     |
| `POST`   | `/auth/login`    | Authenticates the user and starts a session. |
| `POST`   | `/auth/refresh`  | Refreshes the authentication session.        |
| `POST`   | `/auth/logout`   | Ends the current session.                    |

### Error handling

API errors follow a consistent response shape:

```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Task not found",
  "status": 404
}
```

- Validation failures return `400 VALIDATION_ERROR`.
- Unknown routes return `404 RESOURCE_NOT_FOUND`.
- Unexpected failures return `500 INTERNAL_ERROR` without exposing stack traces or original error messages.

The frontend's global API error interceptor maps failures to `ApiHttpError`:

- API errors preserve `code`, `message`, and `status`.
- Network failures use `code: "NETWORK_ERROR"` and `status: 0`.
- HTTP failures without an API error body use `code: "HTTP_ERROR"`.
- Unknown client errors use `code: "CLIENT_ERROR"`.

## Web

The Angular frontend provides the task board and authentication screens.

### Task management

- Lists tasks, newest first.
- Displays loading, empty, and error states.
- Creates and edits tasks through Angular Material dialogs with title and description validation.
- Confirms deletions before removing tasks.
- Toggles completion inline and communicates status through text and icons, not color alone.
- Refreshes tasks from the API on demand.
- Disables affected controls while a task request is in flight.
- Waits for the API response before applying changes; updates are not optimistic.

### Authentication and feedback

- Provides login and registration forms with validation.
- Displays authentication and request errors through Angular Material `MatSnackBar`.
- Uses the shared API error handling layer for consistent feedback.

### Responsive design and accessibility

- Uses Angular Material components and CDK utilities.
- Maintains a single-column layout on small screens and adds spacing at desktop breakpoints.
- Uses full-screen dialogs on small screens.
- Provides `aria-label` values for icon-only buttons.
- Restores focus to the triggering element after dialogs close.
- Supports light and dark themes, following the operating system preference by default.
- Stores the selected theme in `localStorage` under `task-board-theme`.
- Keeps CSS `color-scheme` and `meta[name="theme-color"]` synchronized with the active theme.

The application is a single screen; Angular Router is not used.

### Runtime configuration

The web app loads `config.json` from its public root during startup, before rendering the task board. The local configuration is:

```json
{
  "apiBaseUrl": "http://localhost:3001"
}
```

The configuration service resolves the file relative to the application base path, validates `apiBaseUrl`, and removes a trailing slash.

For deployment, replace the `config.json` published alongside `index.html`. This allows the same build to be promoted between environments.

Build the frontend and generate the deployment configuration from `API_BASE_URL`:

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

The script writes `dist/web/browser/config.json` using the shared `@repo/config-env` validation. It reads `API_BASE_URL` from the process environment, not from the root `.env`.

The value must be an absolute HTTP(S) URL or a path starting with `/`. `NODE_ENV` defaults to `production`; the script rejects localhost in that mode.

Deployment requirements:

- Serve `config.json` with `Cache-Control: no-cache`.
- Add the deployed web origin to the API's `ALLOWED_ORIGINS` when the app and API use different origins.
- Never put secrets in `config.json`; it is publicly accessible.

> If the production `config.json` is not replaced, browsers will attempt to reach their own `localhost:3001`.

See the [web README](apps/web/README.md) for full frontend documentation.

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

Migrations live in `apps/api/db/migrations/{up,down}` and follow the naming convention `YYYYMMDDHHmmss_name.sql`.

Applied migrations are checksummed. Never edit an applied migration; create a new one instead. Seeds are plain SQL files and are not tracked by the migration table, so they must be idempotent.

```bash
npm run db:reset -- --yes --seed
```

This command drops the API-owned tables, reapplies migrations, and runs seeds. It is destructive and should only be used against development data.

See the [database README](apps/api/db/README.md) for migration, seed, reset, and recovery details.

## Tests

The web tests use Vitest with jsdom. The API and `db-tools` tests use the Node.js test runner and a real MySQL server.

Create the root `.env` and start MySQL before running the full suite:

```bash
npm test
```

Run a single workspace:

```bash
npm test -w web
npm test -w api
npm test -w @repo/db-tools
```

The API tests create a temporary database from the migrations and drop it afterward. The `db-tools` tests create random databases per test file; they do not connect to the development database.

Quality gates:

```bash
npm run lint
npm run check-types
npm run build
```

## Deployment

The Compose file starts MySQL for local development. Production deployments must provide their own MySQL instance and inject server configuration through the hosting platform's secret/configuration mechanism.

Recommended release steps:

1. Configure the API environment, including `NODE_ENV=production`, database credentials, Redis settings, and `ALLOWED_ORIGINS`.
2. Run `npm run db:migrate` against the target database before starting the API.
3. Build the API:

   ```bash
   npm run build -w api
   ```

4. Start the compiled server from `apps/api/dist` using the configured environment:

   ```bash
   npm run start -w api
   ```

5. Build the web app and generate its runtime configuration:

   ```bash
   npm run build -w web
   API_BASE_URL=https://api.example.com npm run runtime-config -w web
   ```

6. Publish `apps/web/dist/web/browser` and serve `config.json` with `Cache-Control: no-cache`.
7. Verify `GET /health` returns `ok` and that a database-dependent endpoint responds successfully before routing production traffic. `/health` reports process liveness, not database reachability.

A CI pipeline should run:

```bash
npm ci
npm run lint
npm run check-types
npm test
npm run build
```

The test job needs a MySQL 8.4 service and the database variables required by the root `.env`. The web build artifact is not ready for a remote API until `config.json` has been generated for the target environment.

## Troubleshooting

- **API exits during startup:** Check the root `.env`; startup validation reports missing or invalid environment variables.
- **`npm run db:up` fails:** Confirm Docker is running and port `3306` is available. If another MySQL instance uses it, change `MYSQL_PORT`.
- **Database commands cannot connect:** The container may still be starting. Check `docker compose ps` or run `npm run db:logs`.
- **Web calls localhost after deployment:** Replace `dist/web/browser/config.json` and invalidate its cache.
- **CORS errors:** Add the exact web origin to `ALLOWED_ORIGINS` and restart the API. Wildcards are not allowed when credentials are enabled.
- **`db:reset` refuses to run:** It requires `--yes` for non-interactive use and `--force` when `NODE_ENV=production`.
- **Tests fail before running:** Start MySQL and verify that `MYSQL_ROOT_PASSWORD` is available in the root `.env`.

## Design decisions

- **Monorepo:** Turborepo keeps the API, frontend, and shared packages in one workspace while preserving independent build and test commands.
- **Runtime frontend configuration:** A public `config.json` allows the same web build to be promoted across environments without rebuilding.
- **Server-side secrets:** Credentials stay out of the browser. Local secrets belong in the root `.env`; production deployments should inject them through the hosting platform.
- **Database migrations:** Versioned SQL migrations and the shared `@repo/db-tools` CLI manage schema changes.
- **Predictable UI updates:** The board waits for API responses instead of applying optimistic changes.
- **Consistent errors:** The API and frontend normalize errors into predictable response and client-side formats.
- **Authentication boundary:** The API owns authentication and session management; protected task operations require an authenticated session.
