import Database from 'better-sqlite3';

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
  
  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Running migration ${migration.version}: ${migration.description}`);
      try {
        db.transaction(() => {
          migration.up(db);
          db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
        })();
        console.log(`✅ Migration ${migration.version} completed`);
      } catch (error) {
        console.error(`❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }
  }
}