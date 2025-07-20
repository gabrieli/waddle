import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { unlinkSync } from 'node:fs';
import { createDatabase, closeDatabase } from './database.ts';
import { runMigrations } from './migrations.ts';

describe('Database Constraints', () => {
  let db: any;

  beforeEach(() => {
    // Use in-memory database for tests
    db = createDatabase(':memory:');
    runMigrations(db);
  });

  describe('work_items table constraints', () => {
    test('should enforce work_items status constraints (reject invalid status values)', () => {
      assert.throws(() => {
        db.prepare(`
          INSERT INTO work_items (name, status, description, type) 
          VALUES (?, ?, ?, ?)
        `).run('Test Work', 'invalid_status', 'Test description', 'epic');
      }, /CHECK constraint failed/);
    });

    test('should accept valid status values', () => {
      const validStatuses = ['new', 'in_progress', 'review', 'done'];
      
      validStatuses.forEach(status => {
        assert.doesNotThrow(() => {
          db.prepare(`
            INSERT INTO work_items (name, status, description, type) 
            VALUES (?, ?, ?, ?)
          `).run(`Test Work ${status}`, status, 'Test description', 'epic');
        });
      });
    });

    test('should validate branch_name format (feature/work-item-{id}-{slug})', () => {
      // Insert work item first
      const result = db.prepare(`
        INSERT INTO work_items (name, status, description, type) 
        VALUES (?, ?, ?, ?)
      `).run('Test Work', 'new', 'Test description', 'epic');
      
      const workItemId = result.lastInsertRowid;

      // Valid branch name should work
      assert.doesNotThrow(() => {
        db.prepare(`
          UPDATE work_items 
          SET branch_name = ? 
          WHERE id = ?
        `).run(`feature/work-item-${workItemId}-test-slug`, workItemId);
      });

      // Invalid branch name should fail
      assert.throws(() => {
        db.prepare(`
          UPDATE work_items 
          SET branch_name = ? 
          WHERE id = ?
        `).run('invalid-branch-name', workItemId);
      }, /CHECK constraint failed/);
    });

    test('should allow NULL branch_name', () => {
      const result = db.prepare(`
        INSERT INTO work_items (name, status, description, type, branch_name) 
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Work', 'new', 'Test description', 'epic', null);
      
      assert.strictEqual(typeof result.lastInsertRowid, 'number');
    });
  });

  describe('foreign key relationships', () => {
    test('should enforce foreign key relationships (prevent orphaned records)', () => {
      // Try to insert work item with non-existent parent_id (the only FK relationship left)
      assert.throws(() => {
        db.prepare(`
          INSERT INTO work_items (name, status, description, type, parent_id) 
          VALUES (?, ?, ?, ?, ?)
        `).run('Test Work', 'new', 'Test description', 'epic', 999);
      }, /FOREIGN KEY constraint failed/);
    });

    test('should allow valid foreign key relationships', () => {
      // Create parent work item first
      const parentResult = db.prepare(`
        INSERT INTO work_items (name, status, description, type) 
        VALUES (?, ?, ?, ?)
      `).run('Parent Work Item', 'new', 'Parent description', 'epic');

      // Create child work item with valid parent_id
      assert.doesNotThrow(() => {
        db.prepare(`
          INSERT INTO work_items (name, status, description, type, parent_id) 
          VALUES (?, ?, ?, ?, ?)
        `).run('Child Work Item', 'new', 'Child description', 'user_story', parentResult.lastInsertRowid);
      });
    });
  });

  describe('optimistic locking', () => {
    test('should enforce optimistic locking with version columns', () => {
      // Insert work item
      const result = db.prepare(`
        INSERT INTO work_items (name, status, description, type) 
        VALUES (?, ?, ?, ?)
      `).run('Test Work', 'new', 'Test description', 'epic');
      
      const workItemId = result.lastInsertRowid;

      // Get current version
      const workItem = db.prepare('SELECT version FROM work_items WHERE id = ?').get(workItemId);
      assert.strictEqual(workItem.version, 1);

      // Update with correct version should work
      const updateResult = db.prepare(`
        UPDATE work_items 
        SET status = ?, version = version + 1 
        WHERE id = ? AND version = ?
      `).run('in_progress', workItemId, 1);
      
      assert.strictEqual(updateResult.changes, 1);

      // Update with old version should fail (simulate race condition)
      const failedUpdate = db.prepare(`
        UPDATE work_items 
        SET status = ?, version = version + 1 
        WHERE id = ? AND version = ?
      `).run('done', workItemId, 1); // Using old version 1
      
      assert.strictEqual(failedUpdate.changes, 0);
    });
  });

  describe('environment configuration', () => {
    test('should create separate databases for local and test environments', () => {
      // Test database (in-memory) - already created in beforeEach
      assert.ok(db);

      // Test that we can create file-based database for local environment
      const localDb = createDatabase('./data/waddle-test-temp.db');
      assert.ok(localDb);
      closeDatabase(localDb);
      
      // Clean up test file
      try {
        unlinkSync('./data/waddle-test-temp.db');
      } catch (e) {
        // File might not exist, that's okay
      }
    });
  });

  describe('state transitions logging', () => {
    test('should log state transitions in state_transitions table', () => {
      // Insert work item
      const workResult = db.prepare(`
        INSERT INTO work_items (name, status, description, type) 
        VALUES (?, ?, ?, ?)
      `).run('Test Work', 'new', 'Test description', 'epic');
      
      const workItemId = workResult.lastInsertRowid;

      // Log state transition
      assert.doesNotThrow(() => {
        db.prepare(`
          INSERT INTO state_transitions (work_item_id, from_state, to_state, event, agent_type) 
          VALUES (?, ?, ?, ?, ?)
        `).run(workItemId, 'new', 'in_progress', 'assignment', 'architect');
      });

      // Verify transition was logged
      const transition = db.prepare(`
        SELECT * FROM state_transitions WHERE work_item_id = ?
      `).get(workItemId);
      
      assert.strictEqual(transition.work_item_id, workItemId);
      assert.strictEqual(transition.from_state, 'new');
      assert.strictEqual(transition.to_state, 'in_progress');
      assert.strictEqual(transition.event, 'assignment');
      assert.strictEqual(transition.agent_type, 'architect');
    });
  });
});