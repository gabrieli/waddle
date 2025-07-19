/**
 * Review Processor Tests
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { processReviewTask } from './review-processor.ts';
import { runMigrations } from '../db/migrations.ts';

// Mock Claude client for testing
interface MockClaudeResult {
  success: boolean;
  output: string;
  error?: string;
}

class MockClaudeClient {
  private mockResults: MockClaudeResult[] = [];
  private currentIndex = 0;

  setMockResults(results: MockClaudeResult[]) {
    this.mockResults = results;
    this.currentIndex = 0;
  }

  async executeClaude(prompt: string, options?: any): Promise<MockClaudeResult> {
    if (this.currentIndex >= this.mockResults.length) {
      throw new Error('No more mock results available');
    }
    return this.mockResults[this.currentIndex++];
  }
}

describe('Review Processor', () => {
  function setupTest() {
    // Create in-memory database for testing
    const db = new Database(':memory:');
    runMigrations(db);
    const mockClaudeClient = new MockClaudeClient();

    // Create test work item
    db.prepare(`
      INSERT INTO work_items (id, name, type, status, assigned_to, branch_name, created_at, updated_at)
      VALUES (1, 'Test Feature', 'user_story', 'in_progress', 'developer', 'feature/work-item-1-test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
    
    return { db, mockClaudeClient };
  }

  test('should handle missing task gracefully', async () => {
    const { db, mockClaudeClient } = setupTest();
    const result = await processReviewTask(999, db, mockClaudeClient);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Task not found');
    db.close();
  });

  test('should handle missing work item gracefully', async () => {
    const { db, mockClaudeClient } = setupTest();
    
    // Disable foreign key constraints temporarily to insert task with invalid work item ID
    db.pragma('foreign_keys = OFF');
    
    // Create task with non-existent work item
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 999, 'review', 'new', 'feature/work-item-999-test', CURRENT_TIMESTAMP)
    `).run();
    
    // Re-enable foreign key constraints
    db.pragma('foreign_keys = ON');

    const result = await processReviewTask(1, db, mockClaudeClient);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Work item not found');
    db.close();
  });

  test('should mark work item as done when review is approved', async () => {
    const { db, mockClaudeClient } = setupTest();
    
    // Create review task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'review', 'new', 'feature/work-item-1-test', CURRENT_TIMESTAMP)
    `).run();

    // Mock approved review response
    mockClaudeClient.setMockResults([{
      success: true,
      output: 'The code looks great! All quality standards are met.\n\nREVIEW OUTCOME: APPROVED'
    }]);

    const result = await processReviewTask(1, db, mockClaudeClient);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary, 'The code looks great! All quality standards are met.\n\nREVIEW OUTCOME: APPROVED');

    // Verify work item is marked as done
    const workItem = db.prepare('SELECT * FROM work_items WHERE id = 1').get() as any;
    assert.strictEqual(workItem.status, 'done');

    // Verify task is marked as done
    const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
    assert.strictEqual(task.status, 'done');
    assert.ok(task.completed_at);
    db.close();
  });

  test('should create development task when changes are required', async () => {
    const { db, mockClaudeClient } = setupTest();
    
    // Create review task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'review', 'new', 'feature/work-item-1-test', CURRENT_TIMESTAMP)
    `).run();

    // Mock review response requiring changes
    mockClaudeClient.setMockResults([{
      success: true,
      output: 'The code has several issues that need to be addressed:\n\n1. Missing error handling\n2. Poor variable naming\n\nREVIEW OUTCOME: CHANGES REQUIRED'
    }]);

    const result = await processReviewTask(1, db, mockClaudeClient);
    
    assert.strictEqual(result.success, true);

    // Verify a new development task was created
    const developmentTask = db.prepare('SELECT * FROM tasks WHERE type = ? AND user_story_id = ? ORDER BY id DESC LIMIT 1').get('development', 1) as any;
    assert.ok(developmentTask);
    assert.strictEqual(developmentTask.branch_name, 'feature/work-item-1-test');
    assert.ok(developmentTask.summary.includes('Address code review feedback'));
    assert.ok(developmentTask.summary.includes('Missing error handling'));

    // Verify work item is NOT marked as done
    const workItem = db.prepare('SELECT * FROM work_items WHERE id = 1').get() as any;
    assert.strictEqual(workItem.status, 'in_progress');

    // Verify review task is marked as done
    const reviewTask = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
    assert.strictEqual(reviewTask.status, 'done');
    db.close();
  });

  test('should handle Claude client failure gracefully', async () => {
    const { db, mockClaudeClient } = setupTest();
    
    // Create review task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'review', 'new', 'feature/work-item-1-test', CURRENT_TIMESTAMP)
    `).run();

    // Mock Claude client failure
    mockClaudeClient.setMockResults([{
      success: false,
      output: '',
      error: 'Claude API error'
    }]);

    const result = await processReviewTask(1, db, mockClaudeClient);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Claude API error');

    // Verify task status hasn't changed
    const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
    assert.strictEqual(task.status, 'new');
    db.close();
  });

  test('should handle unclear review outcome gracefully', async () => {
    const { db, mockClaudeClient } = setupTest();
    
    // Create review task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'review', 'new', 'feature/work-item-1-test', CURRENT_TIMESTAMP)
    `).run();

    // Mock review response without clear outcome
    mockClaudeClient.setMockResults([{
      success: true,
      output: 'The code is mostly good but needs some clarification on requirements.'
    }]);

    const result = await processReviewTask(1, db, mockClaudeClient);
    
    assert.strictEqual(result.success, true);

    // Verify review task is marked as done even with unclear outcome
    const reviewTask = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
    assert.strictEqual(reviewTask.status, 'done');

    // Verify work item status hasn't changed
    const workItem = db.prepare('SELECT * FROM work_items WHERE id = 1').get() as any;
    assert.strictEqual(workItem.status, 'in_progress');
    db.close();
  });

  test('should mark task as done after processing', async () => {
    const { db, mockClaudeClient } = setupTest();
    
    // Create review task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'review', 'new', 'feature/work-item-1-test', CURRENT_TIMESTAMP)
    `).run();

    // Mock approved review response
    mockClaudeClient.setMockResults([{
      success: true,
      output: 'Code looks good!\n\nREVIEW OUTCOME: APPROVED'
    }]);

    await processReviewTask(1, db, mockClaudeClient);

    // Verify task is marked as done with timestamps
    const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
    assert.strictEqual(task.status, 'done');
    assert.ok(task.completed_at);
    assert.ok(task.summary.includes('REVIEW OUTCOME: APPROVED'));
    db.close();
  });
});