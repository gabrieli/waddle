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