/**
 * Database module for Waddle
 */

import SQLite from 'better-sqlite3';
import { MigrationRunner } from './migrations';
import * as path from 'path';
import * as fs from 'fs';
import { 
  FeatureRepository, 
  TaskRepository, 
  TransitionRepository, 
  ContextRepository 
} from './repositories';

export class Database {
  private db: SQLite.Database | null = null;
  private dbPath: string;

  // Repository instances
  private _features?: FeatureRepository;
  private _tasks?: TaskRepository;
  private _transitions?: TransitionRepository;
  private _context?: ContextRepository;

  constructor(dbPath = './waddle.db') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    console.log(`💾 Database initializing at ${this.dbPath}`);
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database connection
    this.db = new SQLite(this.dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Run migrations
    const migrationRunner = new MigrationRunner(this.db);
    await migrationRunner.run();
    
    console.log('💾 Database initialized successfully');
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('💾 Database closed');
    }
  }

  getConnection(): SQLite.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  transaction<T>(fn: (db: SQLite.Database) => T): T {
    const db = this.getConnection();
    return db.transaction(fn)(db);
  }

  // Repository getters
  get features(): FeatureRepository {
    if (!this._features) {
      this._features = new FeatureRepository(this.getConnection());
    }
    return this._features;
  }

  get tasks(): TaskRepository {
    if (!this._tasks) {
      this._tasks = new TaskRepository(this.getConnection());
    }
    return this._tasks;
  }

  get transitions(): TransitionRepository {
    if (!this._transitions) {
      this._transitions = new TransitionRepository(this.getConnection());
    }
    return this._transitions;
  }

  get context(): ContextRepository {
    if (!this._context) {
      this._context = new ContextRepository(this.getConnection());
    }
    return this._context;
  }
}