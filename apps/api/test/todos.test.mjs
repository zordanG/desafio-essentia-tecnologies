import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import { createApiDatabase } from '../test-support/helpers.mjs';
import { RedisInstance } from '../dist/config/redis.js';

let app;
let database;
let PoolController;
const cookieJar = new Map();

function updateCookies(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return;

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    const separator = pair.indexOf('=');

    if (separator < 1) continue;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();

    // Cookies expirados ou removidos devem sair do jar.
    if (!value) {
      cookieJar.delete(name);
    } else {
      cookieJar.set(name, value);
    }
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(options) {
  const headers = {
    ...(options.headers ?? {}),
  };

  const cookie = cookieHeader();
  if (cookie) headers.cookie = cookie;

  const response = await app.inject({
    ...options,
    headers,
  });

  updateCookies(response.headers);
  return response;
}

before(async () => {
  database = await createApiDatabase();
  Object.assign(process.env, database.env);

  const [api, db] = await Promise.all([
    import('../dist/api/index.js'),
    import('../dist/config/db.js'),
  ]);

  PoolController = db.PoolController;
  app = api.buildApp();

  await app.ready();
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (PoolController) {
    await PoolController.shutdown();
  }
  if (database) {
    await database.drop();
  }

  RedisInstance.closeInstance();
});

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
