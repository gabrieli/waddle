import Database from 'better-sqlite3';
import { getLogger } from '../utils/logger.js';

export interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Add processing tracking fields',
    up: (db) => {
      // Check if columns already exist
      const tableInfo = db.prepare('PRAGMA table_info(work_items)').all();
      const columnNames = tableInfo.map((col: any) => col.name);
      
      if (!columnNames.includes('processing_started_at')) {
        db.prepare('ALTER TABLE work_items ADD COLUMN processing_started_at TIMESTAMP').run();
      }
      
      if (!columnNames.includes('processing_agent_id')) {
        db.prepare('ALTER TABLE work_items ADD COLUMN processing_agent_id TEXT').run();
      }
    }
  },
  {
    version: 2,
    description: 'Add knowledge base tables for patterns, ADRs, reviews, and agent communications',
    up: (db) => {
      // Create patterns table
      db.prepare(`
        CREATE TABLE IF NOT EXISTS patterns (
          id TEXT PRIMARY KEY,
          agent_role TEXT NOT NULL CHECK(agent_role IN ('manager', 'architect', 'developer', 'reviewer', 'bug-buster')),
          pattern_type TEXT NOT NULL CHECK(pattern_type IN ('solution', 'approach', 'tool_usage', 'error_handling', 'optimization')),
          context TEXT NOT NULL,
          solution TEXT NOT NULL,
          effectiveness_score REAL DEFAULT 0.0 CHECK(effectiveness_score >= 0.0 AND effectiveness_score <= 1.0),
          usage_count INTEGER DEFAULT 0,
          work_item_ids TEXT,
          metadata TEXT,
          embedding TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      // Create ADRs table
      db.prepare(`
        CREATE TABLE IF NOT EXISTS adrs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          context TEXT NOT NULL,
          decision TEXT NOT NULL,
          consequences TEXT,
          status TEXT NOT NULL CHECK(status IN ('proposed', 'accepted', 'deprecated', 'superseded')),
          work_item_id TEXT,
          created_by TEXT NOT NULL,
          superseded_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (work_item_id) REFERENCES work_items(id),
          FOREIGN KEY (superseded_by) REFERENCES adrs(id)
        )
      `).run();
      
      // Create reviews table
      db.prepare(`
        CREATE TABLE IF NOT EXISTS reviews (
          id TEXT PRIMARY KEY,
          work_item_id TEXT NOT NULL,
          reviewer_role TEXT NOT NULL CHECK(reviewer_role IN ('manager', 'architect', 'developer', 'reviewer', 'bug-buster')),
          review_type TEXT NOT NULL CHECK(review_type IN ('code', 'architecture', 'security', 'testing', 'documentation')),
          status TEXT NOT NULL CHECK(status IN ('approved', 'needs_changes', 'rejected')),
          feedback TEXT NOT NULL,
          suggestions TEXT,
          quality_score REAL CHECK(quality_score >= 0.0 AND quality_score <= 1.0),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (work_item_id) REFERENCES work_items(id)
        )
      `).run();
      
      // Create agent_communications table for async messaging
      db.prepare(`
        CREATE TABLE IF NOT EXISTS agent_communications (
          id TEXT PRIMARY KEY,
          from_agent TEXT NOT NULL,
          to_agent TEXT NOT NULL,
          message_type TEXT NOT NULL CHECK(message_type IN ('request', 'response', 'notification', 'query')),
          subject TEXT NOT NULL,
          content TEXT NOT NULL,
          work_item_id TEXT,
          priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
          status TEXT NOT NULL CHECK(status IN ('pending', 'delivered', 'read', 'processed')) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          delivered_at TIMESTAMP,
          read_at TIMESTAMP,
          processed_at TIMESTAMP,
          FOREIGN KEY (work_item_id) REFERENCES work_items(id)
        )
      `).run();
      
      // Create indexes for better query performance
      db.prepare('CREATE INDEX IF NOT EXISTS idx_patterns_agent_role ON patterns(agent_role)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_patterns_effectiveness ON patterns(effectiveness_score DESC)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_adrs_status ON adrs(status)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_adrs_work_item ON adrs(work_item_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_reviews_work_item ON reviews(work_item_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_comms_to_agent ON agent_communications(to_agent, status)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_comms_work_item ON agent_communications(work_item_id)').run();
    },
    down: (db) => {
      // Drop indexes
      db.prepare('DROP INDEX IF EXISTS idx_patterns_agent_role').run();
      db.prepare('DROP INDEX IF EXISTS idx_patterns_type').run();
      db.prepare('DROP INDEX IF EXISTS idx_patterns_effectiveness').run();
      db.prepare('DROP INDEX IF EXISTS idx_adrs_status').run();
      db.prepare('DROP INDEX IF EXISTS idx_adrs_work_item').run();
      db.prepare('DROP INDEX IF EXISTS idx_reviews_work_item').run();
      db.prepare('DROP INDEX IF EXISTS idx_reviews_status').run();
      db.prepare('DROP INDEX IF EXISTS idx_agent_comms_to_agent').run();
      db.prepare('DROP INDEX IF EXISTS idx_agent_comms_work_item').run();
      
      // Drop tables
      db.prepare('DROP TABLE IF EXISTS agent_communications').run();
      db.prepare('DROP TABLE IF EXISTS reviews').run();
      db.prepare('DROP TABLE IF EXISTS adrs').run();
      db.prepare('DROP TABLE IF EXISTS patterns').run();
    }
  }
];

export function runMigrations(db: Database.Database): void {
  const logger = getLogger();
  
  logger.debug('Checking for pending migrations');
  
  // Create migrations table if it doesn't exist
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  // Get applied migrations
  const appliedVersions = new Set(
    db.prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row: any) => row.version)
  );
  
  logger.debug('Applied migrations', { versions: Array.from(appliedVersions) });
  
  // Run pending migrations
  let migrationsRun = 0;
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      const migrationId = `migration-${migration.version}`;
      logger.info(`Running migration ${migration.version}`, { 
        version: migration.version, 
        description: migration.description 
      });
      
      try {
        const startTime = Date.now();
        
        db.transaction(() => {
          migration.up(db);
          db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
        })();
        
        const duration = Date.now() - startTime;
        logger.info(`Migration ${migration.version} completed`, { 
          version: migration.version,
          duration,
          description: migration.description 
        });
        migrationsRun++;
      } catch (error) {
        logger.error(`Migration ${migration.version} failed`, { 
          version: migration.version,
          description: migration.description,
          error: error as Error 
        });
        throw error;
      }
    }
  }
  
  if (migrationsRun === 0) {
    logger.debug('No pending migrations');
  } else {
    logger.info('All migrations completed', { count: migrationsRun });
  }
}