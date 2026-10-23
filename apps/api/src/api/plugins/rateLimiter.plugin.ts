import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../utils/app-error.js';
import { RateLimiter } from '../../config/rateLimiter.js';

declare module 'fastify' {
  interface FastifyInstance {
    rateLimiterPerId: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    rateLimiterPerIpHook: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function ratePerId(request: FastifyRequest) {
  const { userId } = request.user;
  if (!userId) throw AppError.unauthorized();

  const isAllowed = await RateLimiter.perUser('api', request.url, userId).check();

  if (!isAllowed) {
    throw AppError.tooManyRequests();
  }
}

async function ratePerIp(request: FastifyRequest) {
  const ip = request.ip;
  if (!ip) throw AppError.internal();

  const isAllowed = await RateLimiter.perIp('api', request.url, ip).check();
  if (!isAllowed) throw AppError.tooManyRequests();
}

export default fp(async function (app: FastifyInstance) {
  app.decorate('rateLimiterPerId', ratePerId);
  app.decorate('rateLimiterPerIpHook', ratePerIp);
});
