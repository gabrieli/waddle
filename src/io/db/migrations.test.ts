import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { runMigrations, getCurrentSchemaVersion, CURRENT_SCHEMA_VERSION } from './migrations.ts';

describe('Database Migrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
  });

  after(() => {
    if (db) {
      db.close();
    }
  });

  it('should start with version 0', () => {
    const version = getCurrentSchemaVersion(db);
    assert.strictEqual(version, 0);
  });

  it('should migrate to current version', () => {
    runMigrations(db);
    const version = getCurrentSchemaVersion(db);
    assert.strictEqual(version, CURRENT_SCHEMA_VERSION);
  });

  it('should create all required tables', () => {
    runMigrations(db);
    
    // Check existing tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    
    assert(tableNames.includes('work_items'));
    assert(tableNames.includes('agents'));
    assert(tableNames.includes('state_transitions'));
    assert(tableNames.includes('scheduler_config'));
    assert(tableNames.includes('schema_version'));
  });

  describe('Tasks table migration', () => {
    it('should create tasks table with all required fields', () => {
      runMigrations(db);
      
      // Check if tasks table exists
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").all();
      assert.strictEqual(tables.length, 1, 'tasks table should exist');
      
      // Check table structure
      const columns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;
      
      const columnNames = columns.map(c => c.name);
      assert(columnNames.includes('id'));
      assert(columnNames.includes('user_story_id'));
      assert(columnNames.includes('parent_task_id'));
      assert(columnNames.includes('type'));
      assert(columnNames.includes('status'));
      assert(columnNames.includes('summary'));
      assert(columnNames.includes('created_at'));
      assert(columnNames.includes('started_at'));
      assert(columnNames.includes('completed_at'));
      assert(columnNames.includes('metadata'));
    });

    it('should enforce task type constraints', () => {
      runMigrations(db);
      
      // Enable foreign keys
      db.exec('PRAGMA foreign_keys = ON');
      
      // Insert a user story first
      db.prepare(`
        INSERT INTO work_items (name, status, type, description) 
        VALUES ('Test Story', 'new', 'user_story', 'Test description')
      `).run();
      
      // Valid types should work
      const validInsert = db.prepare(`
        INSERT INTO tasks (user_story_id, type, status) 
        VALUES (1, 'development', 'new')
      `);
      assert.doesNotThrow(() => validInsert.run());
      
      // Invalid type should fail
      const invalidInsert = db.prepare(`
        INSERT INTO tasks (user_story_id, type, status) 
        VALUES (1, 'invalid_type', 'new')
      `);
      assert.throws(() => invalidInsert.run(), /CHECK constraint failed/);
    });

    it('should enforce task status constraints', () => {
      runMigrations(db);
      
      // Enable foreign keys
      db.exec('PRAGMA foreign_keys = ON');
      
      // Insert a user story first
      db.prepare(`
        INSERT INTO work_items (name, status, type, description) 
        VALUES ('Test Story', 'new', 'user_story', 'Test description')
      `).run();
      
      // Valid statuses should work
      const validStatuses = ['new', 'in_progress', 'done'];
      for (const status of validStatuses) {
        const insert = db.prepare(`
          INSERT INTO tasks (user_story_id, type, status) 
          VALUES (1, 'development', ?)
        `);
        assert.doesNotThrow(() => insert.run(status));
      }
      
      // Invalid status should fail
      const invalidInsert = db.prepare(`
        INSERT INTO tasks (user_story_id, type, status) 
        VALUES (1, 'development', 'invalid_status')
      `);
      assert.throws(() => invalidInsert.run(), /CHECK constraint failed/);
    });

    it('should handle foreign key relationships correctly', () => {
      runMigrations(db);
      
      // Enable foreign keys
      db.exec('PRAGMA foreign_keys = ON');
      
      // Insert a work item first
      db.prepare(`
        INSERT INTO work_items (name, status, type, description) 
        VALUES ('Test Story', 'new', 'user_story', 'Test description')
      `).run();
      
      // Insert a task referencing the work item
      const insertTask = db.prepare(`
        INSERT INTO tasks (user_story_id, type, status) 
        VALUES (1, 'development', 'new')
      `);
      assert.doesNotThrow(() => insertTask.run());
      
      // Insert a child task
      const insertChildTask = db.prepare(`
        INSERT INTO tasks (user_story_id, parent_task_id, type, status) 
        VALUES (1, 1, 'testing', 'new')
      `);
      assert.doesNotThrow(() => insertChildTask.run());
      
      // Invalid foreign key should fail
      const invalidInsert = db.prepare(`
        INSERT INTO tasks (user_story_id, type, status) 
        VALUES (999, 'development', 'new')
      `);
      assert.throws(() => invalidInsert.run(), /FOREIGN KEY constraint failed/);
    });
  });
});