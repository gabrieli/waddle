/**
 * Database module entry point
 * Handles dual environment setup and initialization
 */

import { createDatabase, closeDatabase, getDatabaseConfig } from './database.ts';
import { runMigrations } from './migrations.ts';
import Database from 'better-sqlite3';

let dbInstance: Database.Database | null = null;

/**
 * Initialize database for the current environment
 */
export function initializeDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const config = getDatabaseConfig();
  console.log(`Initializing ${config.environment} database at ${config.path}`);

  dbInstance = createDatabase();
  runMigrations(dbInstance);

  console.log(`Database initialized successfully for ${config.environment} environment`);
  return dbInstance;
}

/**
 * Get the current database instance
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    return initializeDatabase();
  }
  return dbInstance;
}

/**
 * Close the current database connection
 */
export function closeDatabaseConnection(): void {
  if (dbInstance) {
    closeDatabase(dbInstance);
    dbInstance = null;
  }
}

/**
 * Reset database (useful for tests)
 */
export function resetDatabase(): Database.Database {
  closeDatabaseConnection();
  return initializeDatabase();
}

// Export database utilities
export { createDatabase, closeDatabase, getDatabaseConfig } from './database.ts';
export { runMigrations, getCurrentSchemaVersion, rollbackToVersion } from './migrations.ts';
export type { DatabaseConfig } from './database.ts';