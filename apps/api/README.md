# `api`

Fastify HTTP API for the TechX task management app.

## Requirements

- Node.js >= 24
- The repository root `.env` file, with the variables listed below

## Environment

The API reads the single `.env` file at the repository root and validates it at
boot. Missing or invalid variables abort the startup with an error listing
every problem at once.

| Variable          | Required | Default      | Description                                                                              |
| ----------------- | -------- | ------------ | ---------------------------------------------------------------------------------------- |
| `NODE_ENV`        | No       | `production` | `development`, `test` or `production`. Controls whether error logs include stack traces. |
| `LOG_LEVEL`       | No       | `info`       | Minimum log level: `debug`, `info`, `warn` or `error`.                                   |
| `PORT`            | No       | `3001`       | HTTP port the server listens on.                                                         |
| `HOST`            | Yes      | -            | Interface the server binds to. `0.0.0.0` accepts external connections.                   |
| `ALLOWED_ORIGINS` | Yes      | -            | Comma separated list of CORS origins.                                                    |
| `MYSQL_HOST`      | Yes      | -            | MySQL host the API connects to.                                                          |
| `MYSQL_PORT`      | No       | `3306`       | MySQL port.                                                                              |
| `MYSQL_USER`      | Yes      | -            | MySQL user.                                                                              |
| `MYSQL_PASSWORD`  | Yes      | -            | MySQL password.                                                                          |
| `MYSQL_DATABASE`  | Yes      | -            | MySQL database name.                                                                     |

> `NODE_ENV` defaults to `production` so a deployment that forgets to set it does
> not expose the Swagger UI at `/docs` or stack traces in the logs. Locally, keep
> `NODE_ENV=development` in the root `.env`, as `.env.example` does.

## Scripts

| Command               | Description                                     |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Starts the server with reload on `src` changes. |
| `npm run build`       | Compiles TypeScript into `dist`.                |
| `npm run start`       | Runs the compiled server from `dist`.           |
| `npm run lint`        | Runs ESLint.                                    |
| `npm run check-types` | Runs the TypeScript compiler without emitting.  |

Run them from this directory, or from the repository root through Turborepo.

## Endpoints

| Method   | Path         | Response                        |
| -------- | ------------ | ------------------------------- |
| `GET`    | `/health`    | `{ "status": "ok" }`            |
| `GET`    | `/docs`      | Swagger UI (not in production). |
| `POST`   | `/todos`     | Creates a task.                 |
| `GET`    | `/todos`     | Lists tasks, newest first.      |
| `GET`    | `/todos/:id` | Returns one task.               |
| `PATCH`  | `/todos/:id` | Updates a task.                 |
| `DELETE` | `/todos/:id` | Deletes a task.                 |

Logs are written as one JSON line per event on stdout.

## Database

The API opens a MySQL pool on the first query, using the `MYSQL_*` variables
above. Queries are written inline in the controllers and every row is parsed
with Zod in `src/config/db.query.ts`.

Migrations and seeds are managed by the `@repo/db-tools` CLI for this service.
The service config is `apps/api/db-tools.json`, and the SQL files live under
`apps/api/db/`. See `db/README.md` for the full reference. From the repository
root:

```bash
npm run db:migrate        # apply pending migrations
npm run db:migrate:status # show what is applied
npm run db:reset -- --yes --seed
```

The `tasks` table stores `id` (UUID), `title`, `description`, `completed`,
`created_at` and `updated_at`.

## Tests

The API integration tests call `buildApp().inject()` against a temporary MySQL
database created from the migrations in `apps/api/db/migrations/up`, then drop
it. Start the container and run from the repository root:

```bash
npm test
# or only this workspace:
npm test -w api
```

The tests read the root `.env` and require `MYSQL_ROOT_PASSWORD` to create the
temporary database.

## Errors

Error responses always use the same shape:

| Field     | Description                                       |
| --------- | ------------------------------------------------- |
| `code`    | Machine-readable code, e.g. `RESOURCE_NOT_FOUND`. |
| `message` | Human-readable message.                           |
| `status`  | HTTP status, repeated in the body.                |

| Situation                      | Response                                 |
| ------------------------------ | ---------------------------------------- |
| `AppError` thrown by a handler | Its own `status`, `code` and `message`.  |
| Invalid request data (Zod)     | `400` `VALIDATION_ERROR`.                |
| Unknown route                  | `404` `RESOURCE_NOT_FOUND`.              |
| Invalid JSON                   | `400` `BAD_REQUEST`.                     |
| Payload too large              | `413` `PAYLOAD_TOO_LARGE`.               |
| Unsupported content type       | `415` `UNSUPPORTED_MEDIA_TYPE`.          |
| Other client errors            | Their 4xx status, code mapped from it.   |
| Anything unexpected            | `500` `INTERNAL_ERROR`, generic message. |

Client errors keep their status and use the code that matches it (`400`
`BAD_REQUEST`, `401` `UNAUTHORIZED`, `403` `FORBIDDEN`, `404`
`RESOURCE_NOT_FOUND`, `409` `CONFLICT`, `413` `PAYLOAD_TOO_LARGE`, `415`
`UNSUPPORTED_MEDIA_TYPE`, `429` `TOO_MANY_REQUESTS`); any other 4xx falls back
to `BAD_REQUEST`.

Unexpected errors are logged as `Unhandled request error` with the `requestId`,
which also appears in the `Request completed` access log. The response never
includes the stack or the original error message.
