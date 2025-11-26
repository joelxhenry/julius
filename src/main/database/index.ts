import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema/index';

let db: ReturnType<typeof drizzle> | null = null;

export function initDatabase() {
  if (db) return db;

  // Get user data path for production database
  // When running from CLI (migration scripts), use local database path
  let dbPath: string;
  
  if (app && app.isReady()) {
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'database.db');
  } else {
    // CLI mode - use local development database
    dbPath = path.join(process.cwd(), 'database.db');
  }

  // Ensure directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  console.log('Initializing database at:', dbPath);

  // Initialize SQLite
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL'); // Enable WAL mode for better performance

  // Initialize Drizzle
  db = drizzle(sqlite, { schema });

  // Run migrations
  try {
    const migrationsFolder = path.join(__dirname, 'migrations');
    console.log('Running migrations from:', migrationsFolder);

    // Check if migrations folder exists
    if (fs.existsSync(migrationsFolder)) {
      migrate(db, { migrationsFolder });
      console.log('Database migrations completed successfully');
    } else {
      console.warn('Migrations folder not found, skipping migrations');
    }
  } catch (error) {
    console.error('Database migration failed:', error);
  }

  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export { schema };
