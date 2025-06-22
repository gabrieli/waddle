import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import { runMigrations } from './migrations.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (!db) {
    const databasePath = dbPath || path.join(__dirname, '../../orchestrator.db');
    db = new Database(databasePath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
  }
  
  return db;
}

export function initializeDatabase(dbPath?: string): void {
  const database = getDatabase(dbPath);
  
  try {
    // Create tables
    database.exec(SCHEMA.work_items);
    database.exec(SCHEMA.work_history);
    
    // Create indices
    for (const index of SCHEMA.indices) {
      database.exec(index);
    }
    
    // Run migrations
    runMigrations(database);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}