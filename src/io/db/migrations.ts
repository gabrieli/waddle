import Database from 'better-sqlite3';

/**
 * Schema version information
 */
export const CURRENT_SCHEMA_VERSION = 8;

/**
 * Migration interface
 */
interface Migration {
  version: number;
  name: string;
  up: string[];
  down: string[];
}

/**
 * All database migrations
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: [
      // Work Items Table
      `CREATE TABLE work_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'review', 'done')),
        description TEXT,
        type TEXT NOT NULL CHECK (type IN ('epic', 'user_story', 'bug')),
        assigned_to TEXT CHECK (assigned_to IN ('developer', 'architect', 'tester')),
        agent_id INTEGER,
        parent_id INTEGER,
        branch_name TEXT CHECK (branch_name LIKE 'feature/work-item-%-%' OR branch_name IS NULL),
        worktree_path TEXT,
        version INTEGER DEFAULT 1,
        started_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (parent_id) REFERENCES work_items(id)
      )`,
      
      // Agents Table
      `CREATE TABLE agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('developer', 'architect', 'tester')),
        work_item_id INTEGER,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_item_id) REFERENCES work_items(id)
      )`,
      
      // State Transition Log Table
      `CREATE TABLE state_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_item_id INTEGER NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        event TEXT,
        agent_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_item_id) REFERENCES work_items(id)
      )`,
      
      // Schema version tracking table
      `CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Insert initial schema version
      `INSERT INTO schema_version (version) VALUES (1)`
    ],
    down: [
      'DROP TABLE IF EXISTS state_transitions',
      'DROP TABLE IF EXISTS agents', 
      'DROP TABLE IF EXISTS work_items',
      'DROP TABLE IF EXISTS schema_version'
    ]
  },
  {
    version: 2,
    name: 'add_scheduler_config',
    up: [
      // Scheduler Configuration Table
      `CREATE TABLE scheduler_config (
        id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton table
        is_running BOOLEAN NOT NULL DEFAULT 0,
        interval_seconds INTEGER NOT NULL DEFAULT 5,
        last_run_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Insert default configuration (scheduler off by default)
      `INSERT INTO scheduler_config (id, is_running, interval_seconds) 
       VALUES (1, 0, 5)`
    ],
    down: [
      'DROP TABLE IF EXISTS scheduler_config'
    ]
  },
  {
    version: 3,
    name: 'add_tasks_table',
    up: [
      // Tasks Table
      `CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_story_id INTEGER NOT NULL,
        parent_task_id INTEGER,
        type TEXT NOT NULL CHECK (type IN ('development', 'testing', 'review')),
        status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'done')),
        summary TEXT,
        metadata TEXT, -- JSON stored as text
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (user_story_id) REFERENCES work_items(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
      )`
    ],
    down: [
      'DROP TABLE IF EXISTS tasks'
    ]
  },
  {
    version: 4,
    name: 'add_branch_name_to_tasks',
    up: [
      // Add branch_name column to tasks table
      `ALTER TABLE tasks ADD COLUMN branch_name TEXT`
    ],
    down: [
      // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
      // For now, we'll leave this as a comment since it's complex
      '-- Cannot easily drop column in SQLite'
    ]
  },
  {
    version: 5,
    name: 'add_wait_to_tasks',
    up: [
      // Add wait column to tasks table
      `ALTER TABLE tasks ADD COLUMN wait BOOLEAN DEFAULT FALSE`
    ],
    down: [
      // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
      '-- Cannot easily drop column in SQLite'
    ]
  },
  {
    version: 6,
    name: 'add_reviewer_agent_type',
    up: [
      // SQLite doesn't support modifying CHECK constraints directly
      // We need to recreate tables with new constraints
      `CREATE TABLE work_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'review', 'done')),
        description TEXT,
        type TEXT NOT NULL CHECK (type IN ('epic', 'user_story', 'bug')),
        assigned_to TEXT CHECK (assigned_to IN ('developer', 'architect', 'tester', 'reviewer')),
        agent_id INTEGER,
        parent_id INTEGER,
        branch_name TEXT CHECK (branch_name LIKE 'feature/work-item-%-%' OR branch_name IS NULL),
        worktree_path TEXT,
        version INTEGER DEFAULT 1,
        started_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (parent_id) REFERENCES work_items(id)
      )`,
      `INSERT INTO work_items_new SELECT * FROM work_items`,
      `DROP TABLE work_items`,
      `ALTER TABLE work_items_new RENAME TO work_items`,
      
      `CREATE TABLE agents_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('developer', 'architect', 'tester', 'reviewer')),
        work_item_id INTEGER,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_item_id) REFERENCES work_items(id)
      )`,
      `INSERT INTO agents_new (id, type, work_item_id, version, created_at) 
       SELECT id, type, work_item_id, version, created_at FROM agents`,
      `DROP TABLE agents`,
      `ALTER TABLE agents_new RENAME TO agents`
    ],
    down: [
      // SQLite doesn't support modifying CHECK constraints directly
      '-- Cannot easily revert CHECK constraint changes in SQLite'
    ]
  },
  {
    version: 7,
    name: 'add_failed_task_status',
    up: [
      // SQLite doesn't support modifying CHECK constraints directly
      // We need to recreate the tasks table with new status constraint
      `CREATE TABLE tasks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_story_id INTEGER NOT NULL,
        parent_task_id INTEGER,
        type TEXT NOT NULL CHECK (type IN ('development', 'testing', 'review')),
        status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'done', 'failed')),
        summary TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        branch_name TEXT,
        wait BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_story_id) REFERENCES work_items(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
      )`,
      `INSERT INTO tasks_new SELECT * FROM tasks`,
      `DROP TABLE tasks`,
      `ALTER TABLE tasks_new RENAME TO tasks`
    ],
    down: [
      // SQLite doesn't support modifying CHECK constraints directly
      '-- Cannot easily revert CHECK constraint changes in SQLite'
    ]
  },
  {
    version: 8,
    name: 'remove_agent_assignment_system',
    up: [
      // Disable foreign key constraints during migration
      `PRAGMA foreign_keys = OFF`,
      
      // Remove agent assignment fields - agents table kept for UI tracking only
      `CREATE TABLE work_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'review', 'done')),
        description TEXT,
        type TEXT NOT NULL CHECK (type IN ('epic', 'user_story', 'bug')),
        parent_id INTEGER,
        branch_name TEXT CHECK (branch_name LIKE 'feature/work-item-%-%' OR branch_name IS NULL),
        worktree_path TEXT,
        version INTEGER DEFAULT 1,
        started_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES work_items(id)
      )`,
      `INSERT INTO work_items_new (id, name, status, description, type, parent_id, branch_name, worktree_path, version, started_at, created_at, updated_at)
       SELECT id, name, status, description, type, parent_id, branch_name, worktree_path, version, started_at, created_at, updated_at FROM work_items`,
      `DROP TABLE work_items`,
      `ALTER TABLE work_items_new RENAME TO work_items`,
      
      // Simplify agents table - remove work_item_id assignment tracking
      `CREATE TABLE agents_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('developer', 'architect', 'tester')),
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `INSERT INTO agents_new (id, type, version, created_at, updated_at)
       SELECT id, type, version, created_at, COALESCE(updated_at, created_at) FROM agents`,
      `DROP TABLE agents`,
      `ALTER TABLE agents_new RENAME TO agents`,
      
      // Re-enable foreign key constraints
      `PRAGMA foreign_keys = ON`
    ],
    down: [
      // SQLite doesn't support adding constraints easily, complex rollback not implemented
      '-- Cannot easily revert agent assignment system removal in SQLite'
    ]
  }
];

/**
 * Get current schema version from database
 */
export function getCurrentSchemaVersion(db: Database.Database): number {
  try {
    const result = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number };
    return result?.version || 0;
  } catch (error) {
    // Table doesn't exist, assume version 0
    return 0;
  }
}

/**
 * Run database migrations
 */
export function runMigrations(db: Database.Database): void {
  const currentVersion = getCurrentSchemaVersion(db);
  
  // Run migrations in a transaction
  const transaction = db.transaction(() => {
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        
        for (const statement of migration.up) {
          db.exec(statement);
        }
        
        // Update schema version
        if (migration.version > 1) {
          db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
        }
      }
    }
  });
  
  transaction();
  
  console.log(`Database schema up to date (version ${CURRENT_SCHEMA_VERSION})`);
}

/**
 * Rollback to specific schema version
 */
export function rollbackToVersion(db: Database.Database, targetVersion: number): void {
  const currentVersion = getCurrentSchemaVersion(db);
  
  if (targetVersion >= currentVersion) {
    console.log('Target version is not lower than current version');
    return;
  }
  
  const transaction = db.transaction(() => {
    // Find migrations to rollback (in reverse order)
    const migrationsToRollback = migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version);
    
    for (const migration of migrationsToRollback) {
      console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
      
      for (const statement of migration.down) {
        db.exec(statement);
      }
      
      // Remove schema version entry
      db.prepare('DELETE FROM schema_version WHERE version = ?').run(migration.version);
    }
  });
  
  transaction();
  
  console.log(`Database rolled back to version ${targetVersion}`);
}