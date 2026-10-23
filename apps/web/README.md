# TechX Tasks — Web

Angular application for managing tasks through the TechX Tasks API.

## Requirements

- Node.js >= 24
- The API running at `http://localhost:3001`
- `ALLOWED_ORIGINS` in the repository root `.env` including `http://localhost:3000`

## Features

### Task management

- Lists all registered tasks, newest first.
- Displays loading, empty, and error states.
- Creates and edits tasks through Angular Material dialogs, with title and description validation.
- Deletes tasks after a confirmation dialog.
- Marks tasks as complete or open inline.
- Communicates task status through text and icons, without relying on color alone.
- Refreshes the task list from the API on demand.
- Disables affected controls while requests are in flight.
- Waits for API responses before applying changes, avoiding optimistic updates.

### Authentication and feedback

- Provides login and registration forms with validation.
- Displays authentication errors and other user feedback through `MatSnackBar`.
- Uses the shared API error handling layer to standardize HTTP, network, and client errors.

### Responsive UI and accessibility

- Uses Angular Material components and CDK utilities.
- Maintains a single-column layout on small screens and adds spacing at desktop breakpoints.
- Uses full-screen dialogs on small screens.
- Provides accessible labels for icon-only buttons.
- Restores focus to the triggering element after dialogs close.
- Supports light and dark themes, following the operating system preference by default.
- Persists the selected theme in `localStorage` under `task-board-theme`.
- Keeps `color-scheme` and `meta[name="theme-color"]` synchronized with the active theme.

## Development

From the repository root:

```bash
npm run dev -w web
```

Or start the API and web app together:

```bash
npm run dev
```

The development server runs at `http://localhost:3000`.

## Scripts

| Command               | Description                                 |
| --------------------- | ------------------------------------------- |
| `npm run dev`         | Starts the Angular development server.      |
| `npm run build`       | Creates a production build.                 |
| `npm run lint`        | Runs ESLint.                                |
| `npm run check-types` | Runs the Angular compiler and checks types. |
| `npm test`            | Runs the unit tests.                        |

Run the commands from this directory or from the repository root through Turborepo.

## Runtime configuration

The application loads `config.json` from its public root during startup, before rendering the task board. This file defines the API base URL:

```json
{
  "apiBaseUrl": "http://localhost:3001"
}
```

The configuration is handled by `src/app/core/config/app-config.service.ts`, which resolves the file relative to the application base path, validates `apiBaseUrl`, and removes a trailing slash.

`public/config.json` is copied to the build output. For deployment, replace the `config.json` published alongside `index.html` with the API URL for the target environment. This allows the same build to be promoted between environments without rebuilding.

Serve `config.json` with `Cache-Control: no-cache` to prevent stale runtime configuration from being reused after deployment.

When the web app and API run on different origins, add the web app's origin to the API's `ALLOWED_ORIGINS` list.

**Security:** `config.json` is public and must never contain secrets.

### Deployment configuration

After building, generate the deployment configuration from `API_BASE_URL`:

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

The script rewrites `dist/web/browser/config.json` using the shared `@repo/config-env` validation.

`NODE_ENV` defaults to `production`. The script fails if `API_BASE_URL` is missing, is not an absolute HTTP(S) URL or a path starting with `/`, or points to localhost while `NODE_ENV=production`.

## API

The web app reads the API base URL from the runtime configuration. During local development, it defaults to `http://localhost:3001`.

| Method   | Path             | Result                                       |
| -------- | ---------------- | -------------------------------------------- |
| `GET`    | `/api/todos`     | Lists tasks, newest first.                   |
| `POST`   | `/api/todos`     | Creates a task and returns `201`.            |
| `GET`    | `/api/todos/:id` | Returns a single task.                       |
| `PATCH`  | `/api/todos/:id` | Updates a task.                              |
| `DELETE` | `/api/todos/:id` | Deletes a task and returns `204`.            |
| `POST`   | `/auth/register` | Creates an account and starts a session.     |
| `POST`   | `/auth/login`    | Authenticates the user and starts a session. |
| `POST`   | `/auth/refresh`  | Refreshes the authentication session.        |
| `POST`   | `/auth/logout`   | Ends the current session.                    |

### Error handling

The global API error interceptor maps failures to `ApiHttpError`:

- API errors preserve `code`, `message`, and `status`.
- Network failures use `code: "NETWORK_ERROR"` and `status: 0`.
- HTTP failures without an API error body use `code: "HTTP_ERROR"`.
- Unknown client errors use `code: "CLIENT_ERROR"`.

Success and failure feedback is presented through Angular Material's `MatSnackBar`.

## Theme

When no theme preference is stored, the interface follows the operating system's color scheme.

The toolbar toggle switches between light and dark themes. The selected theme is stored in `localStorage` under `task-board-theme`.

The application keeps the CSS `color-scheme` property and `meta[name="theme-color"]` synchronized with the active theme.

## UI and structure

- **Angular Material:** UI components and CDK utilities.
- **Typography:** Roboto and Material Symbols Rounded, self-hosted through Fontsource.
- **Task board:** `src/app/components/todos`.
- **Runtime configuration:** `src/app/core/config/app-config.service.ts`.

The UI uses accessible labels for icon-only buttons, restores focus after dialogs, and communicates task completion through both icons and text.

## Tests

Unit tests use Vitest.

- **Service tests** verify HTTP contracts using `HttpTestingController`.
- **Component tests** use stubbed services to isolate UI behavior.
- **Authentication tests** cover form validation, submission behavior, navigation, loading states, and error feedback through `MatSnackBar`.

Run the tests with:

```bash
npm test
```
