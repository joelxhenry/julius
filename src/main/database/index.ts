import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema/index';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseConfig } from '../config/types';
import { runSeeds } from './seed';

export type DatabaseSchema = typeof schema;
export type AppDatabase = NodePgDatabase<typeof schema>;

let db: AppDatabase | null = null;
let pool: Pool | null = null;
let connectionError: Error | null = null;

/**
 * Initialize database connection
 * Returns null on failure to allow graceful degradation
 */
export async function initDatabase(): Promise<AppDatabase | null> {
  if (db) return db;

  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = configManager.load();

    console.log('Initializing PostgreSQL connection...');
    console.log(`Host: ${config.database.host}:${config.database.port}`);
    console.log(`Database: ${config.database.database}`);
    console.log(`User: ${config.database.user}`);
    console.log(`Password type: ${typeof config.database.password}`);
    console.log(`Password length: ${config.database.password?.length || 0}`);
    console.log(`Password is string: ${typeof config.database.password === 'string'}`);

    // Create connection pool
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: config.database.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    await testConnection(pool);

    // Initialize Drizzle
    db = drizzle(pool, { schema });

    // Run migrations
    await runMigrations(db);

    // Run seeds (creates super user if not exists)
    await runSeeds(db);

    connectionError = null;
    console.log('Database initialized successfully');

    return db;
  } catch (error) {
    connectionError = error as Error;
    console.error('Database initialization failed:', error);
    console.error('Application will run in degraded mode');

    // Return null to allow app to start
    return null;
  }
}

/**
 * Test database connection
 */
async function testConnection(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    console.log('Database connection test successful');
  } finally {
    client.release();
  }
}

/**
 * Run database migrations
 */
async function runMigrations(db: AppDatabase): Promise<void> {
  try {
    const migrationsFolder = path.join(__dirname, 'migrations');
    console.log('Checking migrations folder:', migrationsFolder);

    // Check if migrations folder exists and has files
    if (!fs.existsSync(migrationsFolder)) {
      console.warn('Migrations folder not found, skipping migrations');
      return;
    }

    const files = fs.readdirSync(migrationsFolder);
    if (files.length === 0) {
      console.warn('No migration files found, skipping migrations');
      return;
    }

    console.log(`Found ${files.length} migration file(s), applying migrations...`);
    await migrate(db, { migrationsFolder });
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    // Don't throw - allow app to start even if migrations fail
    console.warn('Continuing without migrations...');
  }
}

/**
 * Get database instance
 * Throws error if database not initialized
 */
export function getDatabase(): AppDatabase {
  if (!db) {
    if (connectionError) {
      throw new DatabaseConnectionError(
        'Database not available. Please check your connection settings.',
        connectionError
      );
    }
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Get database instance or null (for graceful handling)
 */
export function getDatabaseOrNull(): AppDatabase | null {
  return db;
}

/**
 * Get connection error if any
 */
export function getConnectionError(): Error | null {
  return connectionError;
}

/**
 * Test database connection with provided config
 */
export async function testDatabaseConnection(
  config: DatabaseConfig
): Promise<{ success: boolean; error?: string }> {
  const testPool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  try {
    await testConnection(testPool);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await testPool.end();
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    connectionError = null;
    console.log('Database connection closed');
  }
}

/**
 * Run migrations and seeds manually
 * This can be triggered from settings to re-run data migrations
 */
export async function runMigrationsAndSeeds(): Promise<{
  success: boolean;
  message: string;
  migrationsRan: boolean;
  seedsRan: boolean;
}> {
  if (!db) {
    return {
      success: false,
      message: 'Database not connected. Please connect to the database first.',
      migrationsRan: false,
      seedsRan: false,
    };
  }

  let migrationsRan = false;
  let seedsRan = false;

  try {
    // Run migrations
    console.log('Running migrations manually...');
    await runMigrations(db);
    migrationsRan = true;

    // Run seeds
    console.log('Running seeds manually...');
    await runSeeds(db);
    seedsRan = true;

    return {
      success: true,
      message: 'Migrations and seeds completed successfully.',
      migrationsRan,
      seedsRan,
    };
  } catch (error) {
    console.error('Error running migrations and seeds:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      migrationsRan,
      seedsRan,
    };
  }
}

/**
 * Custom error for database connection failures
 */
export class DatabaseConnectionError extends Error {
  constructor(message: string, public cause: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

// Alias for convenience
export { getDatabase as db, schema };
