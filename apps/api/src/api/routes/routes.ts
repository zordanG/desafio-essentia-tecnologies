import type { FastifyTypedInstance } from '../types.js';
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

  await app.register(todoRoutes);
}
