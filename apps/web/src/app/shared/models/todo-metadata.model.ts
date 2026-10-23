export interface TodoMetadata {
  taskId: string;
  tags: string[];
  color?: string;
  customFields?: Record<string, unknown>;
  updatedAt: string;
}

export interface PutTodoMetadataDto {
  tags: string[];
  color?: string;
  customFields?: Record<string, unknown>;
}

export type PatchTodoMetadataDto = Partial<PutTodoMetadataDto>;
