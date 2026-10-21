# `api`

Fastify HTTP API for the Essentia Technologies challenge.

## Requirements

- Node.js >= 24
- The repository root `.env` file, with the variables listed below

## Environment

The API reads the single `.env` file at the repository root and validates it at
boot. Missing or invalid variables abort the startup with an error listing
every problem at once.

| Variable | Required | Default | Description                                                            |
| -------- | -------- | ------- | ---------------------------------------------------------------------- |
| `PORT`   | No       | `3001`  | HTTP port the server listens on.                                       |
| `HOST`   | Yes      | -       | Interface the server binds to. `0.0.0.0` accepts external connections. |

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

| Method | Path      | Response             |
| ------ | --------- | -------------------- |
| `GET`  | `/health` | `{ "status": "ok" }` |
