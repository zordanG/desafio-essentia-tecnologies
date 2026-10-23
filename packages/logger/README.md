# `@repo/logger`

One JSON line per call, written with `console.log` (stdout on Node, console in
the browser). The level comes from the validated environment, never from
`process.env` inside the package.

```ts
import { createLogger } from '@repo/logger';

const logger = createLogger({ level: 'info', name: 'api' });

logger.info('server ready', { port: 3001 });
// {"level":"info","time":"2026-10-22T22:00:00.000Z","name":"api","message":"server ready","port":3001}

logger.error('database failed', { err, attempt: 1 });
// {"level":"error","time":"...","name":"api","message":"database failed","err":{"name":"Error","code":"ECONNREFUSED","message":"connect ECONNREFUSED","stack":"..."},"attempt":1}
```

Everything passed after `message` is spread into the line. `Error` values are
serialized to `{ name, message, code?, stack? }` at any depth.

In production, disable the stack:

```ts
const logger = createLogger({
  level: env.LOG_LEVEL,
  name: 'api',
  includeStack: env.NODE_ENV !== 'production',
});
```

## API

| Export                                         | Description                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `createLogger(options?)`                       | Options: `level` (default `info`), `name`, `includeStack` (default `true`). |
| `logger.debug/info/warn/error(message, data?)` | Writes one line when the level is enabled.                                  |
| `LogLevel`, `Logger`, `LoggerOptions`          | Types.                                                                      |

Levels, from most to least verbose: `debug`, `info`, `warn`, `error`.

## Notes

- **No redaction or sanitization.** The logger writes what it receives: never
  log tokens, passwords, raw requests or raw errors. `includeStack` exposes
  absolute paths, so keep it off in production.
- **Reserved keys.** `level`, `time`, `name` and `message` belong to the logger;
  avoid the same names in `data`.
- **Never throws.** If a value cannot be serialized (e.g. a cycle), a minimal
  line is written instead.
- **Exported as TypeScript source.** Like the other internal packages, there is
  no build step: consumers import `src/index.ts` directly.
