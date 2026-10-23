# `web`

Angular task management app for TechX Tasks.

## Requirements

- Node.js >= 24
- The API running at `http://localhost:3001`
- `ALLOWED_ORIGINS` in the repository root `.env` including
  `http://localhost:3000`

## Features

- Lists every registered task, newest first.
- Shows loading, empty and error states.
- Creates and edits tasks in a Material dialog with title and description
  validation.
- Deletes tasks after a confirmation dialog.
- Marks tasks complete or open inline, with a text status that does not rely on
  color alone.
- Refreshes the list from the API on demand.
- Disables the affected controls while a task request is in flight.
- Keeps a single-column layout on small screens and adds desktop spacing with
  `min-width` breakpoints.
- Uses full-screen dialogs on small screens.

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

## Runtime configuration

The app loads `config.json` from its public root before Angular bootstraps.
That file sets the API base URL:

```json
{
  "apiBaseUrl": "http://localhost:3001"
}
```

`src/app/core/config/app-config.service.ts` resolves the file relative to the
application base path, validates `apiBaseUrl`, and removes a trailing slash.

`public/config.json` is copied to the build output. For a deployment, replace the
`config.json` published next to `index.html` with the API URL of that environment.
The same build can be promoted without rebuilding. Serve `config.json` with
`Cache-Control: no-cache` so a new deployment is not hidden by a stale cache.

When the web app and the API run on different origins, add the web origin to the
API `ALLOWED_ORIGINS` list.

`config.json` is public. It must never contain secrets.

### Deployment file

After building, generate the deployed file from `API_BASE_URL`:

```bash
npm run build -w web
API_BASE_URL=https://api.example.com npm run runtime-config -w web
```

On PowerShell:

```powershell
npm run build -w web
$env:API_BASE_URL = 'https://api.example.com'
npm run runtime-config -w web
```

The script rewrites `dist/web/browser/config.json` using the shared
`@repo/config-env` validation. `NODE_ENV` defaults to `production`, and the
script fails when `API_BASE_URL` is missing, is not an absolute HTTP(S) URL or
a path starting with `/`, or points to localhost while `NODE_ENV=production`.

## API

The web app reads the API base URL from the runtime configuration. For local
development it points to `http://localhost:3001`.

| Method   | Path         | Result                        |
| -------- | ------------ | ----------------------------- |
| `GET`    | `/todos`     | List tasks, newest first.     |
| `POST`   | `/todos`     | Create a task, returns `201`. |
| `GET`    | `/todos/:id` | Return one task.              |
| `PATCH`  | `/todos/:id` | Update a task.                |
| `DELETE` | `/todos/:id` | Delete a task, returns `204`. |

Updates are not optimistic: the board waits for the API response and replaces
the task with the result. This keeps behavior predictable and testable.

The global API error interceptor maps failures to `ApiHttpError`:

- API errors keep `code`, `message` and `status`.
- Network failures use `code: "NETWORK_ERROR"` and `status: 0`.
- HTTP failures without an API error body use `code: "HTTP_ERROR"`.
- Unknown client errors use `code: "CLIENT_ERROR"`.

Success and failure feedback is announced through `MatSnackBar`.

## Theme

The interface starts with the operating system color scheme. The toolbar toggle
switches between light and dark themes, and the choice is stored in
`localStorage` under `task-board-theme`. `color-scheme` and
`meta[name="theme-color"]` stay in sync with the active theme.

## UI

- [Angular Material](https://material.angular.io/) components and CDK utilities.
- Roboto and Material Symbols Rounded are self-hosted through Fontsource.
- The todo board lives in `src/app/components/todos`.
- Icon-only buttons have `aria-label`, dialogs restore focus to their trigger,
  and completion is communicated by both an icon and text.

## Tests

Unit tests use Vitest. Service tests cover the HTTP contract with
`HttpTestingController`, and component tests use a stubbed `TodoService` to
focus on UI behavior.

```bash
npm test
```
