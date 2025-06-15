/**
 * Database migration system for Waddle
 */

import type Database from 'better-sqlite3';
import { schema, indexes } from '../schema';
import * as technicalDiscoveries from './003-technical-discoveries';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      // Create all tables
      Object.values(schema).forEach(sql => {
        db.exec(sql);
      });

      // Create indexes
      indexes.forEach(sql => {
        db.exec(sql);
      });
    }
  },
  {
    version: 3,
    name: 'technical_discoveries',
    up: technicalDiscoveries.up,
    down: technicalDiscoveries.down
  }
];

export class MigrationRunner {
  constructor(private db: Database.Database) {}

  async run(): Promise<void> {
    // Ensure migrations table exists
    this.db.exec(schema.migrations);

    const appliedMigrations = this.getAppliedMigrations();
    const pendingMigrations = migrations.filter(
      m => !appliedMigrations.includes(m.version)
    );

    for (const migration of pendingMigrations) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);
      
      const transaction = this.db.transaction(() => {
        migration.up(this.db);
        
        const stmt = this.db.prepare(
          'INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)'
        );
        stmt.run(migration.version, migration.name, Date.now());
      });

      transaction();
    }

    if (pendingMigrations.length === 0) {
      console.log('All migrations are up to date');
    } else {
      console.log(`Applied ${pendingMigrations.length} migration(s)`);
    }
  }

  private getAppliedMigrations(): number[] {
    try {
      const rows = this.db.prepare('SELECT version FROM migrations ORDER BY version').all() as { version: number }[];
      return rows.map(row => row.version);
    } catch {
      // Table doesn't exist yet
      return [];
    }
  }
}

// Run migrations if this is the main module
if (require.main === module) {
  import('better-sqlite3').then(({ default: Database }) => {
    const db = new Database('./waddle.db');
    const runner = new MigrationRunner(db);
    
    runner.run()
      .then(() => {
        console.log('Migration completed successfully');
        db.close();
      })
      .catch(error => {
        console.error('Migration failed:', error);
        db.close();
        process.exit(1);
      });
  });
}