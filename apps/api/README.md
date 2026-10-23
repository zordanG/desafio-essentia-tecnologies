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
