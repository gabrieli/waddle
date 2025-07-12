import { test, describe } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { processTestingTask } from './testing-processor.ts';
import { runMigrations } from '../db/migrations.ts';

describe('Testing Processor', () => {
  let db: Database.Database;

  const setupDb = () => {
    // Create in-memory database
    db = new Database(':memory:');
    runMigrations(db);
    
    // Create test data
    db.prepare(`
      INSERT INTO work_items (id, name, type, status, assigned_to)
      VALUES (1, 'Test Feature', 'user_story', 'new', 'developer')
    `).run();
    
    db.prepare(`
      INSERT INTO tasks (id, type, user_story_id, branch_name, status)
      VALUES (1, 'testing', 1, 'feature/test-branch', 'new')
    `).run();
  };

  const cleanupDb = () => {
    if (db) db.close();
  };

  test('should handle missing task gracefully', async () => {
    setupDb();
    
    const result = await processTestingTask(999, db);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Task not found');
    
    cleanupDb();
  });

  test('should handle missing branch_name gracefully', async () => {
    setupDb();
    
    // Create task without branch_name
    db.prepare(`
      INSERT INTO tasks (id, type, user_story_id, status)
      VALUES (2, 'testing', 1, 'new')
    `).run();
    
    const result = await processTestingTask(2, db);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Task has no branch_name specified');
    
    cleanupDb();
  });
  
  test('should mark task as done after processing', async () => {
    setupDb();
    
    // Note: This will fail in tests because there's no actual worktree
    // but we can at least verify it attempts to run and updates the task
    const result = await processTestingTask(1, db);
    
    // Check task was marked as done
    const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
    assert.strictEqual(task.status, 'done');
    assert(task.summary);
    assert(task.completed_at);
    
    cleanupDb();
  });
});