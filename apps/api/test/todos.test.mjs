import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import { createApiDatabase } from '../test-support/helpers.mjs';

let app;
let database;
let PoolController;

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
  if (app) await app.close();
  if (PoolController) await PoolController.shutdown();
  if (database) await database.drop();
});

test('todo CRUD returns the expected contract', async () => {
  let response = await app.inject({
    method: 'POST',
    url: '/todos',
    payload: { title: '  First task  ', description: 'Write the challenge' },
  });

  assert.equal(response.statusCode, 201, response.body);
  const task = response.json();
  assert.match(task.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(task.title, 'First task');
  assert.equal(task.description, 'Write the challenge');
  assert.equal(task.completed, false);
  assert.equal(typeof task.completed, 'boolean');
  assert.ok(!Number.isNaN(Date.parse(task.created_at)));

  response = await app.inject({ method: 'GET', url: '/todos' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.json().map((item) => item.id),
    [task.id],
  );

  response = await app.inject({ method: 'GET', url: `/todos/${task.id}` });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, task.id);

  response = await app.inject({ method: 'GET', url: '/todos/not-a-uuid' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'VALIDATION_ERROR');

  response = await app.inject({ method: 'GET', url: `/todos/${randomUUID()}` });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await app.inject({
    method: 'PATCH',
    url: `/todos/${task.id}`,
    payload: { title: 'Updated task', completed: true },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().title, 'Updated task');
  assert.equal(response.json().completed, true);

  response = await app.inject({
    method: 'PATCH',
    url: `/todos/${task.id}`,
    payload: { description: null },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().description, null);

  response = await app.inject({
    method: 'PATCH',
    url: `/todos/${task.id}`,
    payload: {},
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'BAD_REQUEST');

  response = await app.inject({
    method: 'PATCH',
    url: `/todos/${randomUUID()}`,
    payload: { completed: false },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, 'RESOURCE_NOT_FOUND');

  response = await app.inject({
    method: 'POST',
    url: '/todos',
    payload: { title: '   ' },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'VALIDATION_ERROR');

  response = await app.inject({ method: 'DELETE', url: `/todos/${task.id}` });
  assert.equal(response.statusCode, 204);
  assert.equal(response.body, '');

  response = await app.inject({ method: 'DELETE', url: `/todos/${task.id}` });
  assert.equal(response.statusCode, 404);

  response = await app.inject({ method: 'GET', url: '/todos' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), []);
});
