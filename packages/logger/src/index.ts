export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  /** Minimum level written. Defaults to `info`. */
  level?: LogLevel;
  /** Added to every line, usually the service name. */
  name?: string;
  /** Adds `stack` to error fields. Defaults to `true`; use `false` in production. */
  includeStack?: boolean;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

const order: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** `JSON.stringify` turns an `Error` into `{}`; this keeps the useful fields. */
function errorFields(error: Error, includeStack: boolean): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    code: (error as { code?: unknown }).code,
    ...(includeStack && error.stack ? { stack: error.stack } : {}),
  };
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const { level = 'info', name, includeStack = true } = options;

  const write = (entry: LogLevel, message: string, data?: Record<string, unknown>): void => {
    if (order[entry] < order[level]) return;

    const time = new Date().toISOString();

    try {
      console.log(
        JSON.stringify({ level: entry, time, name, message, ...data }, (_key, value) =>
          value instanceof Error ? errorFields(value, includeStack) : value,
        ),
      );
    } catch {
      // A log line must never break the caller.
      console.log(JSON.stringify({ level: entry, time, name, message }));
    }
  };

  return {
    debug: (message, data) => write('debug', message, data),
    info: (message, data) => write('info', message, data),
    warn: (message, data) => write('warn', message, data),
    error: (message, data) => write('error', message, data),
  };
}
