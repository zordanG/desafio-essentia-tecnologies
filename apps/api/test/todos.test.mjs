import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { request, setupApi } from '../test-support/api-test-context.mjs';

setupApi();

test('Todo CRUD returns the expected contract', async () => {
  const email = `test-${randomUUID()}@example.com`;
  const password = 'testpassword123';

  const registerRes = await request({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password },
  });

  assert.equal(registerRes.statusCode, 201, registerRes.body);

  let response = await request({
    method: 'POST',
    url: '/api/todos',
    payload: {
      title: '  First task  ',
      description: 'Write the challenge',
    },
  });

  assert.equal(response.statusCode, 201, response.body);

  const task = response.json();

  assert.match(task.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(task.title, 'First task');
  assert.equal(task.description, 'Write the challenge');
  assert.equal(task.completed, false);
  assert.equal(typeof task.completed, 'boolean');
  assert.ok(!Number.isNaN(Date.parse(task.created_at)));

  response = await request({
    method: 'GET',
    url: '/api/todos',
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(
    response.json().map((item) => item.id),
    [task.id],
  );

  response = await request({
    method: 'GET',
    url: `/api/todos/${task.id}`,
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().id, task.id);

  response = await request({
    method: 'GET',
    url: '/api/todos/not-a-uuid',
  });

  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, 'VALIDATION_ERROR');

  response = await request({
    method: 'GET',
    url: `/api/todos/${randomUUID()}`,
  });

  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await request({
    method: 'PATCH',
    url: `/api/todos/${task.id}`,
    payload: {
      title: 'Updated task',
      completed: true,
    },
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().title, 'Updated task');
  assert.equal(response.json().completed, true);

  response = await request({
    method: 'PATCH',
    url: `/api/todos/${task.id}`,
    payload: {
      description: null,
    },
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().description, null);

  response = await request({
    method: 'PATCH',
    url: `/api/todos/${task.id}`,
    payload: {},
  });

  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, 'BAD_REQUEST');

  response = await request({
    method: 'PATCH',
    url: `/api/todos/${randomUUID()}`,
    payload: {
      completed: false,
    },
  });

  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await request({
    method: 'POST',
    url: '/api/todos',
    payload: {
      title: '   ',
    },
  });

  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, 'VALIDATION_ERROR');

  response = await request({
    method: 'DELETE',
    url: `/api/todos/${task.id}`,
  });

  assert.equal(response.statusCode, 204, response.body);
  assert.equal(response.body, '');

  response = await request({
    method: 'DELETE',
    url: `/api/todos/${task.id}`,
  });

  assert.equal(response.statusCode, 404, response.body);

  response = await request({
    method: 'GET',
    url: '/api/todos',
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), []);
});
