import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { buildApp } from './api/index.js';

const app = buildApp();

try {
  const address = await app.listen({ port: env.PORT, host: env.HOST });
  logger.info('Server ready', { address });
} catch (error) {
  logger.error('Failed to start server', { err: error, port: env.PORT });
  process.exitCode = 1;
}

async function shutdownEverything(signal: string): Promise<void> {
  logger.info('Shutting down', { signal });

  try {
    await app.close();
  } catch (error) {
    logger.error('Failed to close server', { err: error });
    process.exitCode = 1;
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => void shutdownEverything(signal));
}
