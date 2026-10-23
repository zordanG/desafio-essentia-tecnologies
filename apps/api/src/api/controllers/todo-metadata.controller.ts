import z from 'zod';
import type { FastifyTypedInstance } from '../types.js';
import { AppError, ErrorDefaults } from '../utils/app-error.js';
import { oneOrNone } from '../../config/db.query.js';
import { TaskParamsSchema } from '../models/task.model.js';
import {
  TaskIdRow,
  TodoMetadataDocument,
  TodoMetadataDocumentSchema,
  TodoMetadataPatchSchema,
  TodoMetadataSchema,
} from '../models/todo-metadata.model.js';

function getUserId(request: { user?: { userId?: string } }): string {
  const user = request.user;
  if (!user?.userId) throw AppError.unauthorized();
  return user.userId;
}

async function assertTaskOwnership(
  app: FastifyTypedInstance,
  taskId: string,
  userId: string,
): Promise<void> {
  const task = await oneOrNone(TaskIdRow, 'SELECT id FROM tasks WHERE id = ? AND owner_id = ?', [
    taskId,
    userId,
  ]);

  if (!task) throw AppError.notFound('Task not found');
}

export default async function metadataRoutes(app: FastifyTypedInstance) {
  const collection = app.mongo.collection<TodoMetadataDocument>('todo_metadata');

  app.get(
    '/todos/:id/metadata',
    {
      schema: {
        tags: ['Todo Metadata'],
        description: 'Get metadata for a task',
        params: TaskParamsSchema,
        response: {
          200: TodoMetadataDocumentSchema,
          400: ErrorDefaults[400],
          401: ErrorDefaults[401],
          404: ErrorDefaults[404],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request) => {
      const userId = getUserId(request);
      const { id } = request.params;

      await assertTaskOwnership(app, id, userId);

      const metadata = await collection.findOne({ taskId: id });

      if (!metadata) throw AppError.notFound('Task metadata not found');

      return {
        taskId: metadata.taskId,
        tags: metadata.tags,
        ...(metadata.color !== undefined && { color: metadata.color }),
        ...(metadata.customFields !== undefined && {
          customFields: metadata.customFields,
        }),
        updatedAt: metadata.updatedAt.toISOString(),
      };
    },
  );

  app.put(
    '/todos/:id/metadata',
    {
      schema: {
        tags: ['Todo Metadata'],
        description: 'Create or replace task metadata',
        params: TaskParamsSchema,
        body: TodoMetadataSchema,
        response: {
          200: TodoMetadataDocumentSchema,
          400: ErrorDefaults[400],
          401: ErrorDefaults[401],
          404: ErrorDefaults[404],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;

      await assertTaskOwnership(app, id, userId);

      const body = TodoMetadataSchema.parse(request.body);
      const updatedAt = new Date();

      const metadata: TodoMetadataDocument = {
        ...body,
        tags: [...new Set(body.tags)],
        taskId: id,
        updatedAt,
      };

      await collection.replaceOne({ taskId: id }, { ...metadata, taskId: id }, { upsert: true });

      return reply.status(200).send({
        ...metadata,
        updatedAt: updatedAt.toISOString(),
      });
    },
  );

  app.patch(
    '/todos/:id/metadata',
    {
      schema: {
        tags: ['Todo Metadata'],
        description: 'Partially update task metadata',
        params: TaskParamsSchema,
        body: TodoMetadataPatchSchema,
        response: {
          200: TodoMetadataDocumentSchema,
          400: ErrorDefaults[400],
          401: ErrorDefaults[401],
          404: ErrorDefaults[404],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request) => {
      const userId = getUserId(request);
      const { id } = request.params;
      const body = TodoMetadataPatchSchema.parse(request.body);

      if (Object.keys(body).length === 0) {
        throw AppError.badRequest('At least one field must be provided');
      }

      await assertTaskOwnership(app, id, userId);

      const updatedAt = new Date();

      const update = {
        ...body,
        ...(body.tags !== undefined && {
          tags: [...new Set(body.tags)],
        }),
        updatedAt,
      };

      const result = await collection.updateOne({ taskId: id }, { $set: update });

      if (result.matchedCount === 0) {
        throw AppError.notFound('Task metadata not found');
      }

      const metadata = await collection.findOne({ taskId: id });

      if (!metadata) {
        throw AppError.notFound('Task metadata not found');
      }

      return {
        taskId: metadata.taskId,
        tags: metadata.tags,
        ...(metadata.color !== undefined && { color: metadata.color }),
        ...(metadata.customFields !== undefined && {
          customFields: metadata.customFields,
        }),
        updatedAt: metadata.updatedAt.toISOString(),
      };
    },
  );

  app.delete(
    '/todos/:id/metadata',
    {
      schema: {
        tags: ['Todo Metadata'],
        description: 'Delete task metadata',
        params: TaskParamsSchema,
        response: {
          204: z.undefined(),
          400: ErrorDefaults[400],
          401: ErrorDefaults[401],
          404: ErrorDefaults[404],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;

      await assertTaskOwnership(app, id, userId);

      const result = await collection.deleteOne({ taskId: id });

      if (result.deletedCount === 0) {
        throw AppError.notFound('Task metadata not found');
      }

      return reply.status(204).send();
    },
  );
}
