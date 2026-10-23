import { createLogger } from '@repo/logger';

import { env } from './env.js';

export const logger = createLogger({
  level: env.LOG_LEVEL,
  name: 'api',
  includeStack: env.NODE_ENV !== 'production',
});
