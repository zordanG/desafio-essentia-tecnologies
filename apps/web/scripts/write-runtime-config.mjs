import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEnv } from '@repo/config-env';
import { z } from 'zod';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'dist/web/browser/config.json');
const env = readEnv();

if (env.NODE_ENV === 'production' && isLocalhost(env.API_BASE_URL)) {
  fail('API_BASE_URL must not point to localhost when NODE_ENV=production.');
}

await writeConfig(env.API_BASE_URL === '/' ? '/' : env.API_BASE_URL.replace(/\/+$/, ''));

function readEnv() {
  try {
    return createEnv(
      z.object({
        API_BASE_URL: z
          .string({ error: 'is required' })
          .trim()
          .min(1)
          .refine(
            isSupportedApiBaseUrl,
            'must be an absolute http(s) URL or a path starting with "/"',
          ),
        NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
      }),
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Invalid environment configuration.');
  }
}

async function writeConfig(value) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ apiBaseUrl: value }, null, 2)}\n`, 'utf8');

  console.log(`Runtime configuration written to ${outputPath}`);
}

function isSupportedApiBaseUrl(value) {
  if (value.startsWith('/')) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalhost(value) {
  try {
    const { hostname } = new URL(value);

    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
