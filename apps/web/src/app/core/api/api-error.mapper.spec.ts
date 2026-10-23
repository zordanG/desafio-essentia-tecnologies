import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ApiHttpError } from './api-error';
import { mapHttpError } from './api-error.mapper';

describe('mapHttpError', () => {
  it('Keeps API error details', () => {
    const error = new HttpErrorResponse({
      status: 404,
      statusText: 'Not Found',
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Task not found', status: 404 },
    });

    expect(mapHttpError(error)).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Task not found',
      status: 404,
    });
  });

  it('Maps network failures', () => {
    const error = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    expect(mapHttpError(error)).toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the API',
      status: 0,
    });
  });

  it('Maps HTTP failures without an API error body', () => {
    const error = new HttpErrorResponse({
      status: 500,
      statusText: 'Internal Server Error',
      error: 'Internal server error',
    });

    const mapped = mapHttpError(error);

    expect(mapped).toBeInstanceOf(ApiHttpError);
    expect(mapped.code).toBe('HTTP_ERROR');
    expect(mapped.status).toBe(500);
  });

  it('Maps unknown client errors', () => {
    const mapped = mapHttpError(new Error('Unexpected failure'));

    expect(mapped).toMatchObject({
      code: 'CLIENT_ERROR',
      message: 'Unexpected failure',
      status: 0,
    });
  });

  it('Maps non-Error values', () => {
    expect(mapHttpError('boom')).toMatchObject({
      code: 'CLIENT_ERROR',
      message: 'Unexpected error',
      status: 0,
    });
  });

  it('Returns an existing ApiHttpError unchanged', () => {
    const error = new ApiHttpError('Already mapped', 'NETWORK_ERROR', 0);

    expect(mapHttpError(error)).toBe(error);
  });
});
