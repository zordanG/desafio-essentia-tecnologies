import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  request,
  registerUser,
  createTask,
  setupApi,
  clearCookies,
  saveCookies,
  restoreCookies,
} from '../test-support/api-test-context.mjs';

setupApi();

test('Todo metadata CRUD returns the expected contract', async () => {
  await registerUser();
  const task = await createTask();
  const url = `/api/todos/${task.id}/metadata`;

  // The task has no metadata yet.
  let response = await request({ method: 'GET', url });

  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  // PUT creates the document (upsert), trims and dedupes tags.
  response = await request({
    method: 'PUT',
    url,
    payload: {
      tags: ['  work  ', 'urgent', 'work'],
      color: '#FF00aa',
      customFields: { estimate: 3, nested: { done: false }, list: [1, 2, 3] },
    },
  });

  assert.equal(response.statusCode, 200, response.body);

  const created = response.json();

  assert.equal(created.taskId, task.id);
  assert.deepEqual(created.tags, ['work', 'urgent']);
  assert.equal(created.color, '#FF00aa');
  assert.deepEqual(created.customFields, {
    estimate: 3,
    nested: { done: false },
    list: [1, 2, 3],
  });
  assert.ok(!Number.isNaN(Date.parse(created.updatedAt)));

  // GET returns the same contract.
  response = await request({ method: 'GET', url });

  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), created);

  // PATCH updates only the tags and preserves the rest.
  response = await request({
    method: 'PATCH',
    url,
    payload: { tags: ['  home  ', 'home', 'later'] },
  });

  assert.equal(response.statusCode, 200, response.body);

  const patched = response.json();

  assert.equal(patched.taskId, task.id);
  assert.deepEqual(patched.tags, ['home', 'later']);
  assert.equal(patched.color, '#FF00aa');
  assert.deepEqual(patched.customFields, created.customFields);
  assert.ok(Date.parse(patched.updatedAt) >= Date.parse(created.updatedAt));

  // PATCH updates only the color.
  response = await request({
    method: 'PATCH',
    url,
    payload: { color: '#000000' },
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().color, '#000000');
  assert.deepEqual(response.json().tags, ['home', 'later']);

  // Empty PATCH is rejected.
  response = await request({ method: 'PATCH', url, payload: {} });

  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, 'BAD_REQUEST');

  // GET confirms the final state.
  response = await request({ method: 'GET', url });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().color, '#000000');
  assert.deepEqual(response.json().tags, ['home', 'later']);

  // DELETE removes the document.
  response = await request({ method: 'DELETE', url });

  assert.equal(response.statusCode, 204, response.body);
  assert.equal(response.body, '');

  response = await request({ method: 'DELETE', url });

  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await request({ method: 'GET', url });

  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');
});

test('PUT replaces the metadata document instead of merging it', async () => {
  await registerUser();
  const task = await createTask();
  const url = `/api/todos/${task.id}/metadata`;

  let response = await request({
    method: 'PUT',
    url,
    payload: {
      tags: ['a'],
      color: '#123456',
      customFields: { foo: 'bar' },
    },
  });

  assert.equal(response.statusCode, 200, response.body);

  // Second PUT without color/customFields: they must be gone.
  response = await request({
    method: 'PUT',
    url,
    payload: { tags: ['b'] },
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().tags, ['b']);
  assert.equal(response.json().color, undefined);
  assert.equal(response.json().customFields, undefined);

  response = await request({ method: 'GET', url });

  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().tags, ['b']);
  assert.equal(response.json().color, undefined);
  assert.equal(response.json().customFields, undefined);
});

test('Todo metadata validates ids and payloads', async () => {
  await registerUser();
  const task = await createTask();
  const url = `/api/todos/${task.id}/metadata`;

  // Invalid id on every route.
  for (const method of ['GET', 'DELETE']) {
    const response = await request({ method, url: '/api/todos/not-a-uuid/metadata' });

    assert.equal(response.statusCode, 400, response.body);
    assert.equal(response.json().code, 'VALIDATION_ERROR');
  }

  for (const method of ['PUT', 'PATCH']) {
    const response = await request({
      method,
      url: '/api/todos/not-a-uuid/metadata',
      payload: { tags: ['a'] },
    });

    assert.equal(response.statusCode, 400, response.body);
    assert.equal(response.json().code, 'VALIDATION_ERROR');
  }

  // Nonexistent task.
  const missingUrl = `/api/todos/${randomUUID()}/metadata`;

  let response = await request({ method: 'GET', url: missingUrl });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await request({ method: 'PUT', url: missingUrl, payload: { tags: ['a'] } });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await request({ method: 'PATCH', url: missingUrl, payload: { tags: ['a'] } });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await request({ method: 'DELETE', url: missingUrl });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  // PATCH on an existing task that has no metadata yet.
  response = await request({ method: 'PATCH', url, payload: { tags: ['a'] } });

  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  // Invalid PUT payloads.
  const invalidPutPayloads = [
    {}, // tags is required
    { tags: 'not-an-array' },
    { tags: [''] },
    { tags: ['   '] },
    { tags: ['x'.repeat(51)] },
    { tags: Array.from({ length: 31 }, (_, index) => `tag-${index}`) },
    { tags: ['ok'], color: 'red' },
    { tags: ['ok'], color: '#GGGGGG' },
    { tags: ['ok'], color: '#fff' },
    { tags: ['ok'], customFields: 'not-an-object' },
  ];

  for (const payload of invalidPutPayloads) {
    response = await request({ method: 'PUT', url, payload });

    assert.equal(response.statusCode, 400, `${JSON.stringify(payload)} -> ${response.body}`);
    assert.equal(response.json().code, 'VALIDATION_ERROR');
  }

  // Valid limits: 30 tags and a 50-character tag.
  response = await request({
    method: 'PUT',
    url,
    payload: {
      tags: ['x'.repeat(50), ...Array.from({ length: 29 }, (_, index) => `tag-${index}`)],
    },
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().tags.length, 30);

  // Invalid PATCH payloads.
  const invalidPatchPayloads = [{ tags: [''] }, { color: 'blue' }, { customFields: [] }];

  for (const payload of invalidPatchPayloads) {
    response = await request({ method: 'PATCH', url, payload });

    assert.equal(response.statusCode, 400, `${JSON.stringify(payload)} -> ${response.body}`);
    assert.equal(response.json().code, 'VALIDATION_ERROR');
  }
});

test('Todo metadata is only accessible by the task owner', async () => {
  // User A creates the task and its metadata.
  await registerUser();
  const task = await createTask();
  const url = `/api/todos/${task.id}/metadata`;

  let response = await request({
    method: 'PUT',
    url,
    payload: { tags: ['private'], color: '#abcdef' },
  });

  assert.equal(response.statusCode, 200, response.body);

  // Keep user A session to restore later.
  const sessionA = saveCookies();

  // User B cannot see or change anything.
  await registerUser();

  response = await request({ method: 'GET', url });
  assert.equal(response.statusCode, 404, response.body);

  response = await request({ method: 'PUT', url, payload: { tags: ['hacked'] } });
  assert.equal(response.statusCode, 404, response.body);

  response = await request({ method: 'PATCH', url, payload: { tags: ['hacked'] } });
  assert.equal(response.statusCode, 404, response.body);

  response = await request({ method: 'DELETE', url });
  assert.equal(response.statusCode, 404, response.body);

  // User A data is still intact.
  restoreCookies(sessionA);

  response = await request({ method: 'GET', url });

  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().tags, ['private']);
  assert.equal(response.json().color, '#abcdef');
});

test('Todo metadata requires authentication', async () => {
  await registerUser();
  const task = await createTask();
  const url = `/api/todos/${task.id}/metadata`;

  // Drop the session.
  clearCookies();

  let response = await request({ method: 'GET', url });
  assert.equal(response.statusCode, 401, response.body);

  response = await request({ method: 'PUT', url, payload: { tags: ['a'] } });
  assert.equal(response.statusCode, 401, response.body);

  response = await request({ method: 'PATCH', url, payload: { tags: ['a'] } });
  assert.equal(response.statusCode, 401, response.body);

  response = await request({ method: 'DELETE', url });
  assert.equal(response.statusCode, 401, response.body);
});
