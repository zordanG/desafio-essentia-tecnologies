import type { FastifyTypedInstance } from '../types.js';
import authRoutes from '../controllers/auth.controller.js';
import todoRoutes from '../controllers/todo.controller.js';

export async function routes(app: FastifyTypedInstance) {
  app.get(
    '/health',
    {
      schema: {
        hide: true,
      },
    },
    async () => {
      return { status: 'ok' };
    },
  );

  // Public auth routes
  await app.register(authRoutes, { prefix: '/auth' });

  // Protected routes - require authentication and rate limiting per user
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', app.authenticate);
    protectedApp.addHook('preHandler', app.rateLimiterPerId);

    await protectedApp.register(todoRoutes, { prefix: '/api' });
  });
}
