import z from 'zod';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { PoolController } from './db.js';

// Single place where database rows are parsed with Zod.
function parseRows<T extends z.ZodType>(schema: T, rows: unknown[]): z.infer<T>[] {
  return z.array(schema).parse(rows);
}

// 0 or more rows, from the pool.
async function rows<T extends z.ZodType>(
  schema: T,
  sql: string,
  params?: unknown[],
): Promise<z.infer<T>[]> {
  return parseRows(schema, await PoolController.query(sql, params));
}

// 0 or 1 row, from the pool. Throws when more than 1.
async function oneOrNone<T extends z.ZodType>(
  schema: T,
  sql: string,
  params?: unknown[],
): Promise<z.infer<T> | undefined> {
  const result = await rows(schema, sql, params);

  if (result.length > 1) throw new Error(`Expected at most 1 row, got ${result.length}`);

  return result[0];
}

// 0 or more rows, inside the given transaction.
async function rowsInTx<T extends z.ZodType>(
  client: PoolConnection,
  schema: T,
  sql: string,
  params?: unknown[],
): Promise<z.infer<T>[]> {
  const [result] = await client.query<RowDataPacket[]>(sql, params);

  return parseRows(schema, result);
}

// 0 or 1 row, inside the given transaction. Throws when more than 1.
async function oneOrNoneInTx<T extends z.ZodType>(
  client: PoolConnection,
  schema: T,
  sql: string,
  params?: unknown[],
): Promise<z.infer<T> | undefined> {
  const result = await rowsInTx(client, schema, sql, params);

  if (result.length > 1) throw new Error(`Expected at most 1 row, got ${result.length}`);

  return result[0];
}

// Exactly 1 row, inside the given transaction. Throws otherwise.
async function oneInTx<T extends z.ZodType>(
  client: PoolConnection,
  schema: T,
  sql: string,
  params?: unknown[],
): Promise<z.infer<T>> {
  const result = await rowsInTx(client, schema, sql, params);

  if (result.length !== 1) throw new Error(`Expected exactly 1 row, got ${result.length}`);

  return result[0]!;
}

// No rows returned, inside the given transaction (INSERT/DELETE/UPDATE without RETURNING).
async function runInTx(client: PoolConnection, sql: string, params?: unknown[]): Promise<void> {
  await client.query(sql, params);
}

export { rows, oneOrNone, rowsInTx, oneOrNoneInTx, oneInTx, runInTx };
