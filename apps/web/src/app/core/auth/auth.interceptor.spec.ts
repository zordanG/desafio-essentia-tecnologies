import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('sets withCredentials to true on outgoing requests', () => {
    http.get('/api/todos').subscribe();

    const request = httpTestingController.expectOne('/api/todos');

    expect(request.request.withCredentials).toBe(true);

    request.flush([]);
  });

  it('preserves the original HTTP method and body', () => {
    const body = { title: 'Test task' };

    http.post('/api/todos', body).subscribe();

    const request = httpTestingController.expectOne('/api/todos');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.withCredentials).toBe(true);

    request.flush({ id: 'task-1', ...body });
  });

  it('preserves existing request headers', () => {
    http
      .get('/api/todos', {
        headers: { 'X-Custom-Header': 'test-value' },
      })
      .subscribe();

    const request = httpTestingController.expectOne('/api/todos');

    expect(request.request.headers.get('X-Custom-Header')).toBe('test-value');
    expect(request.request.withCredentials).toBe(true);

    request.flush([]);
  });

  it('passes successful responses through unchanged', () => {
    const responseBody = [{ id: 'task-1', title: 'Test task' }];
    let received: unknown;

    http.get('/api/todos').subscribe((response) => {
      received = response;
    });

    const request = httpTestingController.expectOne('/api/todos');
    request.flush(responseBody);

    expect(received).toEqual(responseBody);
  });

  it('preserves HTTP errors', () => {
    let receivedError: HttpErrorResponse | undefined;

    http.get('/api/todos').subscribe({
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    const request = httpTestingController.expectOne('/api/todos');

    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    expect(receivedError?.status).toBe(401);
    expect(receivedError?.error).toEqual({ message: 'Unauthorized' });
  });
});
