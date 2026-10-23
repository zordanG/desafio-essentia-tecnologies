import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { defineErrorHandler } from '../utils/app-error.js';

export default fp(async function (app: FastifyInstance) {
  app.setErrorHandler(defineErrorHandler);

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      code: 'RESOURCE_NOT_FOUND',
      message: `Route ${request.method}:${request.url.split('?')[0] ?? request.url} not found`,
      status: 404,
    }),
  );
});
