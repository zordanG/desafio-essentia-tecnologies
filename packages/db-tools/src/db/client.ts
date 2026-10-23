import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';
import type { DbEnv } from '../config/env.js';

export const CONTROL_TABLE = 'schema_migrations';

export function getConnectionConfig(env: DbEnv) {
  return {
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    multipleStatements: true,
    // Rows store DATETIME in UTC; parse them as UTC, like the API does.
    timezone: 'Z',
  };
}

export async function connect(env: DbEnv): Promise<Connection> {
  const connection = await createConnection(getConnectionConfig(env));

  await connection.query("SET time_zone = '+00:00'");

  return connection;
}

/**
 * Serializes migrations/seeds for one service using a MySQL advisory lock.
 * The lock lives on the connection, so every query inside `fn` must use it.
 */
export async function withLock<T>(
  client: Connection,
  service: string,
  fn: () => Promise<T>,
): Promise<T> {
  const name = `dbmigrate:${service}`.slice(0, 64);
  const [rows] = await client.query<RowDataPacket[]>('SELECT GET_LOCK(?, 10) AS acquired', [name]);

  if (rows[0]?.acquired !== 1) {
    throw new Error(`could not acquire migration lock "${name}" (another process is running)`);
  }

  try {
    return await fn();
  } finally {
    await client.query('SELECT RELEASE_LOCK(?)', [name]).catch(() => undefined);
  }
}
