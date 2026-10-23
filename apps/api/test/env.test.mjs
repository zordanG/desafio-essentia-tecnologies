import assert from 'node:assert/strict';
import test from 'node:test';

const keys = [
  'NODE_ENV',
  'PORT',
  'HOST',
  'LOG_LEVEL',
  'ALLOWED_ORIGINS',
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'JWT_SECRET',
  'COOKIE_SECRET',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
];

test('The API env module loads the repository root .env', async () => {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) delete process.env[key];

    // Set test values BEFORE importing the module
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.COOKIE_SECRET = 'test-cookie-secret-at-least-32-chars';

    const { env } = await import('../dist/config/env.js');

    assert.ok(env.HOST.length > 0);
    assert.ok(env.MYSQL_HOST.length > 0);
    assert.ok(env.MYSQL_USER.length > 0);
    assert.ok(env.MYSQL_PASSWORD.length > 0);
    assert.ok(env.MYSQL_DATABASE.length > 0);
    assert.ok(Array.isArray(env.ALLOWED_ORIGINS));
    assert.ok(env.ALLOWED_ORIGINS.length > 0);
    assert.equal(typeof env.MYSQL_PORT, 'number');
    assert.ok(env.JWT_SECRET.length >= 32);
    assert.ok(env.REDIS_HOST.length > 0);
    assert.equal(typeof env.REDIS_PORT, 'number');
    assert.ok(env.REDIS_PASSWORD.length > 0);
    assert.ok(env.MONGODB_URI.length > 0);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
