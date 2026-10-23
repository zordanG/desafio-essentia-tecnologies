import { randomUUID } from 'node:crypto';
import z from 'zod';
import type { FastifyTypedInstance } from '../types.js';
import { AppError, ErrorDefaults } from '../utils/app-error.js';
import { PoolController } from '../../config/db.js';
import { oneInTx, oneOrNone, oneOrNoneInTx, rows, runInTx } from '../../config/db.query.js';
import {
  CreateTaskSchema,
  TaskParamsSchema,
  TaskRowSchema,
  TaskSchema,
  UpdateTaskSchema,
} from '../models/task.model.js';

const TaskIdRow = TaskRowSchema.pick({ id: true });

function getUserId(request: { user?: { userId?: string } }): string {
  const user = request.user;
  if (!user?.userId) throw AppError.unauthorized();
  return user.userId;
}

export default async function route(app: FastifyTypedInstance) {
  app.post(
    '/todos',
    {
      schema: {
        tags: ['Todos'],
        description: 'Create a task',
        body: CreateTaskSchema,
        response: {
          201: TaskSchema,
          400: ErrorDefaults[400],
          401: ErrorDefaults[401],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { title, description } = request.body;

      const task = await PoolController.transaction(async (client) => {
        const id = randomUUID();

        await runInTx(
          client,
          'INSERT INTO tasks (id, title, description, owner_id) VALUES (?, ?, ?, ?)',
          [id, title, description ?? null, userId],
        );

        return oneInTx(client, TaskRowSchema, 'SELECT * FROM tasks WHERE id = ?', [id]);
      });

      return reply.status(201).send(task);
    },
  );

  app.get(
    '/todos',
    {
      schema: {
        tags: ['Todos'],
        description: 'List tasks for authenticated user',
        response: {
          200: z.array(TaskSchema),
          401: ErrorDefaults[401],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request) => {
      const userId = getUserId(request);
      return rows(
        TaskRowSchema,
        'SELECT * FROM tasks WHERE owner_id = ? ORDER BY created_at DESC',
        [userId],
      );
    },
  );

  app.get(
    '/todos/:id',
    {
      schema: {
        tags: ['Todos'],
        description: 'Get a task by id',
        params: TaskParamsSchema,
        response: {
          200: TaskSchema,
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

      const task = await oneOrNone(
        TaskRowSchema,
        'SELECT * FROM tasks WHERE id = ? AND owner_id = ?',
        [id, userId],
      );

      if (!task) throw AppError.notFound('Task not found');

      return task;
    },
  );

  app.patch(
    '/todos/:id',
    {
      schema: {
        tags: ['Todos'],
        description: 'Update a task',
        params: TaskParamsSchema,
        body: UpdateTaskSchema,
        response: {
          200: TaskSchema,
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
      const { title, description, completed } = request.body;

      if (title === undefined && description === undefined && completed === undefined)
        throw AppError.badRequest('At least one field must be provided');

      const fields: string[] = [];
      const values: unknown[] = [];

      if (title !== undefined) {
        fields.push('title = ?');
        values.push(title);
      }

      if (description !== undefined) {
        fields.push('description = ?');
        values.push(description);
      }

      if (completed !== undefined) {
        fields.push('completed = ?');
        values.push(completed);
      }

      return PoolController.transaction(async (client) => {
        const existing = await oneOrNoneInTx(
          client,
          TaskIdRow,
          'SELECT id FROM tasks WHERE id = ? AND owner_id = ?',
          [id, userId],
        );

        if (!existing) throw AppError.notFound('Task not found');

        await runInTx(client, `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, [
          ...values,
          id,
        ]);

        return oneInTx(client, TaskRowSchema, 'SELECT * FROM tasks WHERE id = ?', [id]);
      });
    },
  );

  app.delete(
    '/todos/:id',
    {
      schema: {
        tags: ['Todos'],
        description: 'Delete a task',
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

      await PoolController.transaction(async (client) => {
        const existing = await oneOrNoneInTx(
          client,
          TaskIdRow,
          'SELECT id FROM tasks WHERE id = ? AND owner_id = ?',
          [id, userId],
        );

        if (!existing) throw AppError.notFound('Task not found');

        await runInTx(client, 'DELETE FROM tasks WHERE id = ?', [id]);
      });

      return reply.status(204).send();
    },
  );
}
