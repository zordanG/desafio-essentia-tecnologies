import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before } from 'node:test';
import { createApiDatabase } from './helpers.mjs';
import { RedisInstance } from '../dist/config/redis.js';
import { MongoInstance } from '../dist/config/mongo.js';

let app;
let database;
let PoolController;

export function setupApi() {
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
    try {
      if (app) await app.close();
      if (PoolController) await PoolController.shutdown();
      if (database) await database.drop();
    } finally {
      await RedisInstance.closeInstance();
      await MongoInstance.closeInstance();
    }
  });
}

export function createTestClient() {
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

      if (!value) {
        cookieJar.delete(name);
      } else {
        cookieJar.set(name, value);
      }
    }
  }

  async function request(options) {
    const headers = { ...(options.headers ?? {}) };
    const cookie = [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

    if (cookie) headers.cookie = cookie;

    const response = await app.inject({
      ...options,
      headers,
    });

    updateCookies(response.headers);
    return response;
  }

  async function registerUser() {
    cookieJar.clear();

    const response = await request({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: `test-${randomUUID()}@example.com`,
        password: 'testpassword123',
      },
    });

    assert.equal(response.statusCode, 201, response.body);
    return response;
  }

  async function createTask(title = 'Task with metadata') {
    const response = await request({
      method: 'POST',
      url: '/api/todos',
      payload: { title },
    });

    assert.equal(response.statusCode, 201, response.body);
    return response.json();
  }

  return {
    request,
    registerUser,
    createTask,
    clearCookies: () => cookieJar.clear(),
    saveCookies: () => new Map(cookieJar),
    restoreCookies: (cookies) => {
      cookieJar.clear();
      for (const [name, value] of cookies) {
        cookieJar.set(name, value);
      }
    },
  };
}

export const { request, registerUser, createTask, clearCookies, saveCookies, restoreCookies } =
  createTestClient();
