import z from 'zod';
import { TaskRowSchema } from '../models/task.model.js';

const TaskIdRow = TaskRowSchema.pick({ id: true });

const TodoMetadataSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const TodoMetadataPatchSchema = TodoMetadataSchema.partial();

const TodoMetadataDocumentSchema = TodoMetadataSchema.extend({
  taskId: z.uuid(),
  updatedAt: z.iso.datetime(),
});

type TodoMetadata = z.infer<typeof TodoMetadataSchema>;

type TodoMetadataDocument = TodoMetadata & {
  taskId: string;
  updatedAt: Date;
};

export {
  TaskIdRow,
  TodoMetadataSchema,
  TodoMetadataPatchSchema,
  TodoMetadataDocumentSchema,
  type TodoMetadataDocument,
};
