import { createClient, type RedisClientType } from 'redis';
import { env } from './env.js';
import { logger } from './logger.js';

class RedisInstance {
  private static instance: RedisClientType;

  static async getInstance(): Promise<RedisClientType> {
    if (!this.instance) {
      this.instance = createClient({
        password: env.REDIS_PASSWORD,
        socket: {
          host: env.REDIS_HOST,
          port: Number(env.REDIS_PORT ?? 6379),
          family: 4,
        },
      });

      this.instance.on('error', (err) => logger.error('Redis error', { err }));

      await this.instance.connect();
    }
    return this.instance;
  }

  static closeInstance() {
    if (this.instance) {
      this.instance.destroy();
    }
  }
}

export { RedisInstance };
