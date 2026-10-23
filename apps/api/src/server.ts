import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { buildApp } from './api/index.js';
import { PoolController } from './config/db.js';
import { RedisInstance } from './config/redis.js';

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

    RedisInstance.closeInstance();
    await PoolController.shutdown();
  } catch (error) {
    logger.error('Failed to close server', { err: error });
    process.exitCode = 1;
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => void shutdownEverything(signal));
}
