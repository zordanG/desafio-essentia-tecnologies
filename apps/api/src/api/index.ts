import { fastify, type FastifyInstance } from 'fastify';
import { fastifyCors } from '@fastify/cors';
import { fastifySwagger } from '@fastify/swagger';
import { fastifySwaggerUi } from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import fastifyHelmet from '@fastify/helmet';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

function buildApp(): FastifyInstance {
  const app = fastify().withTypeProvider<ZodTypeProvider>();

  // Zod - Validation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Swagger
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Inspector API',
        description: 'API for capturing and inspecting requests',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  if (env.NODE_ENV !== 'production') {
    app.register(fastifySwaggerUi, { routePrefix: '/docs' });
  }

  // Helmet
  app.register(fastifyHelmet);

  // Cors
  app.register(fastifyCors, {
    origin: env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
  });

  // Access log, in the same format as the rest of the application
  app.addHook('onResponse', (request, reply) => {
    logger.info('Request completed', {
      requestId: request.id,
      method: request.method,
      // Query strings can carry tokens and PII; only the path is logged.
      url: request.url.split('?')[0],
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });

  // Routes
  app.register(async (routes) => {
    routes.get('/health', async () => ({ status: 'ok' }));
  });

  return app;
}

export { buildApp };
