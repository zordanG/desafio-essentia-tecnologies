import z from 'zod';
import { Uuid } from './primitives.js';

const Title = z.string().trim().min(1).max(255);
const Description = z.string().trim().max(2000).nullable();

const TaskSchema = z.object({
  id: Uuid,
  title: z.string(),
  description: z.string().nullable(),
  completed: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

// MySQL returns TINYINT(1) as 0/1. This row schema normalizes it; response
// schemas stay transform-free because the Zod serializer uses safeEncode.
const TaskRowSchema = TaskSchema.extend({
  completed: z.union([z.boolean(), z.number()]).transform((value) => value === true || value === 1),
});

const CreateTaskSchema = z.object({
  title: Title,
  description: Description.optional(),
});

const UpdateTaskSchema = z.object({
  title: Title.optional(),
  description: Description.optional(),
  completed: z.boolean().optional(),
});

const TaskParamsSchema = TaskRowSchema.pick({ id: true });

export { TaskSchema, TaskRowSchema, CreateTaskSchema, UpdateTaskSchema, TaskParamsSchema };
