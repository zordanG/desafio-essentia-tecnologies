# `api`

Fastify HTTP API for the Essentia Technologies challenge.

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

| Method | Path      | Response                        |
| ------ | --------- | ------------------------------- |
| `GET`  | `/health` | `{ "status": "ok" }`            |
| `GET`  | `/docs`   | Swagger UI (not in production). |

Logs are written as one JSON line per event on stdout.
