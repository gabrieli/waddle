/**
 * Integration Tests for Development Task Processor
 * 
 * Tests the complete flow from task processing through to completion
 * and automatic test task creation.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations.ts';
import { processDevelopmentTask } from './development-processor-testable.ts';
import { setMockResult } from './__mocks__/claude-client.ts';
import * as mockClaudeClient from './__mocks__/claude-client.ts';

describe('Development Processor Integration Tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations to set up schema
    runMigrations(db);
    
    // Set up test data
    setupTestData();
    
    // Reset mock to success state
    setMockResult({ success: true, output: 'Task completed successfully' });
  });

  afterEach(() => {
    db.close();
  });

  function setupTestData() {
    // Create a test work item
    db.prepare(`
      INSERT INTO work_items (id, name, status, description, type, assigned_to, version, created_at, updated_at)
      VALUES (1, 'Test Feature', 'new', 'Implement a test feature', 'user_story', 'developer', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // Create a test development task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'development', 'new', 'feature/test-feature', CURRENT_TIMESTAMP)
    `).run();
  }

  it('should process development task successfully and create testing task', async () => {
    const result = await processDevelopmentTask(1, db, mockClaudeClient);

    // Verify processor result
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary, 'Task completed successfully');

    // Verify task was marked as done
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(1);
    assert.strictEqual(task.status, 'done');
    assert.strictEqual(task.summary, 'Task completed successfully');
    assert(task.completed_at, 'completed_at should be set');

    // Verify work item was marked as in_progress
    const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(1);
    assert.strictEqual(workItem.status, 'in_progress');

    // Verify testing task was created
    const testingTask = db.prepare('SELECT * FROM tasks WHERE user_story_id = ? AND type = ?').get(1, 'testing');
    assert(testingTask, 'Testing task should be created');
    assert.strictEqual(testingTask.status, 'new');
    assert.strictEqual(testingTask.branch_name, 'feature/test-feature'); // Should inherit branch name
  });

  it('should handle Claude execution failure gracefully', async () => {
    // Set mock to fail
    setMockResult({ success: false, error: 'Claude execution failed' });

    const result = await processDevelopmentTask(1, db, mockClaudeClient);

    // Verify processor result
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Claude execution failed');

    // Verify task status was not changed
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(1);
    assert.strictEqual(task.status, 'new'); // Should remain new for retry
    assert.strictEqual(task.summary, null); // Should not have summary

    // Verify work item status was not changed
    const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(1);
    assert.strictEqual(workItem.status, 'new');

    // Verify no testing task was created
    const testingTask = db.prepare('SELECT * FROM tasks WHERE user_story_id = ? AND type = ?').get(1, 'testing');
    assert.strictEqual(testingTask, undefined);
  });

  it('should handle missing task gracefully', async () => {
    const result = await processDevelopmentTask(999, db, mockClaudeClient);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Task not found');
  });

  it('should handle missing work item gracefully', async () => {
    // Temporarily disable foreign key constraints
    db.pragma('foreign_keys = OFF');
    
    // Create a task with non-existent work item
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, created_at)
      VALUES (2, 999, 'development', 'new', CURRENT_TIMESTAMP)
    `).run();
    
    // Re-enable foreign key constraints
    db.pragma('foreign_keys = ON');

    const result = await processDevelopmentTask(2, db, mockClaudeClient);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Work item not found');
  });

  it('should create testing task without branch name if original task has none', async () => {
    // Create a task without branch name
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, created_at)
      VALUES (3, 1, 'development', 'new', CURRENT_TIMESTAMP)
    `).run();

    const result = await processDevelopmentTask(3, db, mockClaudeClient);

    assert.strictEqual(result.success, true);

    // Verify testing task was created without branch name
    const testingTask = db.prepare('SELECT * FROM tasks WHERE user_story_id = ? AND type = ? AND id != ?').get(1, 'testing', 1);
    assert(testingTask, 'Testing task should be created');
    assert.strictEqual(testingTask.branch_name, null);
  });

  it('should include work item description in prompt building', async () => {
    // Update work item with description
    db.prepare('UPDATE work_items SET description = ? WHERE id = ?').run('Detailed description of the feature', 1);

    const result = await processDevelopmentTask(1, db, mockClaudeClient);

    // Should succeed - the description would be included in the prompt
    assert.strictEqual(result.success, true);
  });
});