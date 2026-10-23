export interface ApiErrorBody {
  code: string;
  message: string;
  status: number;
}

export class ApiHttpError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}
