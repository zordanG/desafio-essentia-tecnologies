export interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string | null;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  completed?: boolean;
}
