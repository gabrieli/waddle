import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import { runMigrations } from './migrations.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;
const logger = getLogger();

export function getDatabase(dbPath?: string): Database.Database {
  if (!db) {
    const databasePath = dbPath || path.join(__dirname, '../../orchestrator.db');
    logger.info('Opening database connection', { path: databasePath });
    
    try {
      db = new Database(databasePath);
      
      // Enable foreign keys
      db.pragma('foreign_keys = ON');
      logger.debug('Foreign keys enabled');
      
      // Enable WAL mode for better concurrency
      db.pragma('journal_mode = WAL');
      logger.debug('WAL mode enabled');
      
      logger.logConnection('connected', { path: databasePath });
    } catch (error) {
      logger.logConnection('error', { 
        path: databasePath, 
        error: error as Error 
      });
      throw error;
    }
  }
  
  return db;
}

export function initializeDatabase(dbPath?: string): void {
  const database = getDatabase(dbPath);
  
  logger.info('Starting database initialization');
  
  try {
    // Create tables
    logger.debug('Creating work_items table');
    database.exec(SCHEMA.work_items);
    
    logger.debug('Creating work_history table');
    database.exec(SCHEMA.work_history);
    
    logger.debug('Creating bug_metadata table');
    database.exec(SCHEMA.bug_metadata);
    
    // Create indices
    logger.debug('Creating database indices');
    for (const index of SCHEMA.indices) {
      database.exec(index);
    }
    
    // Run migrations
    logger.info('Running database migrations');
    runMigrations(database);
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', { error: error as Error });
    throw error;
  }
}

export function closeDatabase(): void {
  if (db) {
    logger.info('Closing database connection');
    try {
      db.close();
      db = null;
      logger.logConnection('disconnected');
    } catch (error) {
      logger.error('Error closing database connection', { error: error as Error });
      throw error;
    }
  }
}