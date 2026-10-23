import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, ApiHttpError } from './api-error';

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ApiErrorBody>;

  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number'
  );
}

export function mapHttpError(error: unknown): ApiHttpError {
  if (error instanceof ApiHttpError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const body = isApiErrorBody(error.error) ? error.error : undefined;
    const status = body?.status ?? error.status;
    const code = body?.code ?? (error.status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR');
    const message =
      body?.message ??
      (error.status === 0 ? 'Unable to reach the API' : error.message || 'Request failed');

    return new ApiHttpError(message, code, status, body ?? error.error);
  }

  if (error instanceof Error) {
    return new ApiHttpError(error.message, 'CLIENT_ERROR', 0);
  }

  return new ApiHttpError('Unexpected error', 'CLIENT_ERROR', 0);
}
