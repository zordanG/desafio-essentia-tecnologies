import { RedisInstance } from '../../config/redis.js';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { RedisClientType } from 'redis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClientType;
  }
}

const redisClient = await RedisInstance.getInstance();

export default fp(function (app: FastifyInstance) {
  app.decorate('redis', redisClient);
});
