import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiHttpError } from '../../core/api/api-error';
import { apiErrorInterceptor } from '../../core/api/api-error.interceptor';
import { AppConfigService } from '../../core/config/app-config.service';
import { TodoService } from './todo.service';
import type { Task } from '../models/task.model';

const API_BASE_URL = 'http://localhost:3001';
const API_URL = `${API_BASE_URL}/todos`;

const TASK: Task = {
  id: '9b2f4c1e-6f38-4f6e-9f8a-3a7c1d2e4b5a',
  title: 'Prepare the daily stand-up',
  description: 'Share progress with the team.',
  completed: false,
  created_at: '2026-10-23T09:00:00.000Z',
  updated_at: '2026-10-23T09:00:00.000Z',
};

describe('TodoService', () => {
  let service: TodoService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: API_BASE_URL } },
      ],
    });

    service = TestBed.inject(TodoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('Lists tasks', () => {
    let result: Task[] | undefined;

    service.list().subscribe((tasks) => (result = tasks));

    const request = httpTesting.expectOne(API_URL);

    expect(request.request.method).toBe('GET');
    request.flush([TASK]);

    expect(result).toEqual([TASK]);
  });

  it('Gets a task by ID', () => {
    let result: Task | undefined;

    service.getById(TASK.id).subscribe((task) => (result = task));

    const request = httpTesting.expectOne(`${API_URL}/${TASK.id}`);

    expect(request.request.method).toBe('GET');
    request.flush(TASK);

    expect(result).toEqual(TASK);
  });

  it('Creates a task', () => {
    const payload = { title: 'Write the release notes' };
    let result: Task | undefined;

    service.create(payload).subscribe((task) => (result = task));

    const request = httpTesting.expectOne(API_URL);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush(
      { ...TASK, ...payload, id: 'new-task-id' },
      { status: 201, statusText: 'Created' },
    );

    expect(result?.title).toBe(payload.title);
  });

  it('Updates a task', () => {
    const payload = { completed: true };
    let result: Task | undefined;

    service.update(TASK.id, payload).subscribe((task) => (result = task));

    const request = httpTesting.expectOne(`${API_URL}/${TASK.id}`);

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);
    request.flush({ ...TASK, completed: true });

    expect(result?.completed).toBe(true);
  });

  it('Removes a task', () => {
    let completed = false;

    service.remove(TASK.id).subscribe({ complete: () => (completed = true) });

    const request = httpTesting.expectOne(`${API_URL}/${TASK.id}`);

    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('Maps API error responses', () => {
    let received: unknown;

    service.getById('missing').subscribe({ error: (error: unknown) => (received = error) });

    const request = httpTesting.expectOne(`${API_URL}/missing`);

    request.flush(
      { code: 'RESOURCE_NOT_FOUND', message: 'Task not found', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );

    expect(received).toBeInstanceOf(ApiHttpError);
    expect(received).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Task not found',
      status: 404,
    });
  });

  it('Maps network failures', () => {
    let received: unknown;

    service.list().subscribe({ error: (error: unknown) => (received = error) });

    const request = httpTesting.expectOne(API_URL);

    request.error(new ProgressEvent('error'));

    expect(received).toBeInstanceOf(ApiHttpError);
    expect(received).toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the API',
      status: 0,
    });
  });
});
