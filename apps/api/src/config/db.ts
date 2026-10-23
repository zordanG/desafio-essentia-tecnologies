import { createPool, type Pool, type PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { env } from './env.js';

class PoolController {
  private static pool: Pool | undefined;

  static getPool(): Pool {
    if (!this.pool) {
      this.pool = createPool({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        // The container runs with `--default-time-zone=+00:00`; parse DATETIME as UTC.
        timezone: 'Z',
      });
    }

    return this.pool;
  }

  static async shutdown(): Promise<void> {
    if (!this.pool) return;

    await this.pool.end();
    this.pool = undefined;
  }

  static async query<T extends RowDataPacket = RowDataPacket>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    const [rows] = await this.getPool().query<T[]>(sql, params);

    return rows;
  }

  static async transaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.getPool().getConnection();

    try {
      await connection.beginTransaction();

      const result = await fn(connection);

      await connection.commit();

      return result;
    } catch (error) {
      await connection.rollback();

      throw error;
    } finally {
      connection.release();
    }
  }
}

export { PoolController };
