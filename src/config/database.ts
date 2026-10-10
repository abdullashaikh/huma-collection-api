import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { env } from './env';
import { logger } from './logger';

export const pool: Pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: env.DB_WAIT_FOR_CONNECTIONS,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+05:30', // Indian Standard Time
  dateStrings: true,
});

/**
 * Executes a parameterized query using the pool.
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const start = Date.now();
  try {
    const [results] = await pool.query(sql, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn(`Slow database query (${duration}ms): ${sql.substring(0, 100)}...`);
    }
    return results as T;
  } catch (error: any) {
    logger.error('Database query error:', {
      sql: sql.substring(0, 200),
      params: JSON.stringify(params),
      error: error.message,
    });
    throw error;
  }
}

/**
 * Executes a set of operations inside an ACID transaction.
 * Automatically handles COMMIT or ROLLBACK.
 */
export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error: any) {
    await connection.rollback();
    logger.error('Transaction rolled back due to error:', { message: error.message });
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Health check to verify database responsiveness.
 */
export async function testDbConnection(): Promise<{ healthy: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1 AS health_check');
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    logger.error('Database health check failed:', { error: err.message });
    return { healthy: false, latencyMs: Date.now() - start };
  }
}
