# `web`

Angular task board for the Essentia Technologies challenge.

## Requirements

- Node.js >= 24
- The API running at `http://localhost:3001`
- `ALLOWED_ORIGINS` in the repository root `.env` including
  `http://localhost:3000`

## Development

From the repository root:

```bash
npm run dev -w web
```

Or start the API and the web app together with `npm run dev`.

The development server runs at `http://localhost:3000`.

## Scripts

| Command               | Description                            |
| --------------------- | -------------------------------------- |
| `npm run dev`         | Starts the Angular development server. |
| `npm run build`       | Creates a production build.            |
| `npm run lint`        | Runs ESLint.                           |
| `npm run check-types` | Runs the Angular compiler.             |
| `npm test`            | Runs the unit tests.                   |

Run them from this directory, or from the repository root through Turborepo.

## API

The web app reads the API base URL from `src/environments/environment.ts`.
For local development it points to `http://localhost:3001`.
