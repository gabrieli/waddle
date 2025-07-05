import Database from 'better-sqlite3';
import { join } from 'path';

export interface DatabaseConfig {
  path: string;
  environment: 'local' | 'test';
}

/**
 * Get database configuration based on environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const environment = process.env.NODE_ENV === 'test' ? 'test' : 'local';
  
  const config: DatabaseConfig = {
    environment,
    path: environment === 'test' 
      ? ':memory:' // Use in-memory database for tests
      : join(process.cwd(), 'data', 'waddle-local.db')
  };

  return config;
}

/**
 * Create database connection with proper configuration
 */
export function createDatabase(customPath?: string): Database.Database {
  const config = getDatabaseConfig();
  const dbPath = customPath || config.path;
  
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Set WAL mode for better concurrency (only for file databases)
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }
  
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(db: Database.Database): void {
  if (db && db.open) {
    db.close();
  }
}

/**
 * Initialize database with schema
 */
export function initializeDatabase(): Database.Database {
  const db = createDatabase();
  return db;
}