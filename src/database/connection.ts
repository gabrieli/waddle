import Database from 'better-sqlite3';
import path from 'path';
import { createAgentsTableSQL } from './schema';

export type Environment = 'local' | 'test';

export class DatabaseConnection {
  private db: Database.Database;
  private environment: Environment;

  constructor(environment: Environment = 'local') {
    this.environment = environment;
    const dbPath = this.getDatabasePath();
    this.db = new Database(dbPath);
    
    // Enable foreign keys (but disable in test mode for simplicity)
    if (this.environment !== 'test') {
      this.db.pragma('foreign_keys = ON');
    }
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    this.ensureTablesExist();
  }

  private getDatabasePath(): string {
    const baseDir = process.cwd();
    const filename = this.environment === 'test' ? 'waddle-test.db' : 'waddle.db';
    return path.join(baseDir, filename);
  }

  private ensureTablesExist(): void {
    // Create agents table
    this.db.exec(createAgentsTableSQL);
    
    // Ensure work_items table exists (maintaining compatibility)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('epic', 'story', 'task', 'bug')),
        parent_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL CHECK(status IN ('backlog', 'ready', 'in_progress', 'review', 'done')),
        assigned_role TEXT CHECK(assigned_role IN ('manager', 'architect', 'developer', 'reviewer', 'bug-buster')),
        processing_started_at TIMESTAMP,
        processing_agent_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES work_items(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_work_items_parent_id ON work_items(parent_id);
      CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
      CREATE INDEX IF NOT EXISTS idx_work_items_assigned_role ON work_items(assigned_role);
    `);

    // Ensure work_history table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_history (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL,
        action TEXT NOT NULL,
        agent_id TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_item_id) REFERENCES work_items(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_work_history_work_item_id ON work_history(work_item_id);
      CREATE INDEX IF NOT EXISTS idx_work_history_created_at ON work_history(created_at);
    `);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}