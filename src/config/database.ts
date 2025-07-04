import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { EnvironmentConfig } from './environment.js';

export type Database = PostgresJsDatabase<typeof schema>;
export type DatabaseConfig = Pick<EnvironmentConfig, 'DATABASE_URL' | 'DB_POOL_MIN' | 'DB_POOL_MAX'>;
export type PoolConfig = {
  min: number;
  max: number;
  idle_timeout: number;
  connect_timeout: number;
};

function createConnectionPool(config: PoolConfig & { url: string }) {
  const client = postgres(config.url, {
    max: config.max,
    idle_timeout: config.idle_timeout,
    connect_timeout: config.connect_timeout,
  });

  return client;
}

function createDatabaseConnection(config: DatabaseConfig): Database {
  const poolConfig = {
    url: config.DATABASE_URL,
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    idle_timeout: 20000, // 20 seconds
    connect_timeout: 5000, // 5 seconds
  };

  const client = createConnectionPool(poolConfig);

  // Attach the underlying postgres client to the Drizzle instance so that
  // callers (e.g. the HTTP server shutdown routine) can close the connection
  // pool gracefully.
  // Use 'any' to avoid type conflicts – we only need the additional `client`
  // property for internal shutdown handling and will treat it cautiously.
  const db: any = drizzle(client, { schema });
  db.client = client;

  return db as Database; // expose both Drizzle API and raw client
}

async function checkDatabaseHealth(db: Database): Promise<boolean> {
  try {
    // Simple query to check if database is responsive
    await db.execute(sql`SELECT 1 as health_check`);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

async function gracefulDatabaseShutdown(client: postgres.Sql): Promise<void> {
  try {
    await client.end({ timeout: 5 });
    console.log('Database connections closed gracefully');
  } catch (error) {
    console.error('Error during database shutdown:', error);
  }
}

function createDatabaseHealthChecker(db: Database) {
  return function performHealthCheck(): Promise<boolean> {
    return checkDatabaseHealth(db);
  };
}

export {
  createDatabaseConnection,
  createConnectionPool,
  checkDatabaseHealth,
  gracefulDatabaseShutdown,
  createDatabaseHealthChecker,
}; 