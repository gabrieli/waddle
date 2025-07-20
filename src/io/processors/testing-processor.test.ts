import { test, describe } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { processTestingTask } from './testing-processor.ts';
import { runMigrations } from '../db/migrations.ts';
import { 
  createMockTestExecutor, 
  createFailingTestExecutor,
  createCustomTestExecutor
} from './test-executors.ts';

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
    
    // Use mock executor (shouldn't matter for this test)
    const mockExecutor = createMockTestExecutor();
    const result = await processTestingTask(999, db, mockExecutor);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Task not found');
    
    cleanupDb();
  });

  test('should handle missing branch_name by using fallback', async () => {
    setupDb();
    
    // Create task without branch_name
    db.prepare(`
      INSERT INTO tasks (id, type, user_story_id, status)
      VALUES (2, 'testing', 1, 'new')
    `).run();
    
    const mockExecutor = createMockTestExecutor();
    const result = await processTestingTask(2, db, mockExecutor);
    
    // Should succeed using fallback branch (current git branch)
    assert.strictEqual(result.success, true);
    assert(result.summary, 'Should have test summary');
    
    cleanupDb();
  });
  
  test('should process passing tests successfully', async () => {
    setupDb();
    
    // Use mock executor that always passes
    const mockExecutor = createMockTestExecutor({
      passed: true,
      output: 'All 15 tests passed successfully'
    });
    
    const result = await processTestingTask(1, db, mockExecutor);
    
    assert.strictEqual(result.success, true);
    assert(result.summary?.includes('All tests passed successfully'));
    assert(result.summary?.includes('All 15 tests passed successfully'));
    
    // Check task was marked as done
    const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
    assert.strictEqual(task.status, 'done');
    assert(task.summary);
    assert(task.completed_at);
    
    // Check that a review task was created
    const reviewTask = db.prepare('SELECT * FROM tasks WHERE type = ? AND user_story_id = ?').get('review', 1);
    assert(reviewTask, 'Review task should be created when tests pass');
    
    cleanupDb();
  });

  test('should handle failing tests correctly', async () => {
    setupDb();
    
    // Use failing test executor
    const failingExecutor = createFailingTestExecutor(
      'Test run summary: 2 failed, 13 passed',
      'Error: TestFailed - Expected true but got false'
    );
    
    const result = await processTestingTask(1, db, failingExecutor);
    
    assert.strictEqual(result.success, true);
    assert(result.summary?.includes('Tests failed'));
    assert(result.summary?.includes('Test run summary: 2 failed, 13 passed'));
    
    // Check task was marked as done
    const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
    assert.strictEqual(task.status, 'done');
    
    // Check that a development task was created (not review)
    const developmentTask = db.prepare('SELECT * FROM tasks WHERE type = ? AND user_story_id = ? AND id != ?').get('development', 1, 1);
    assert(developmentTask, 'Development task should be created when tests fail');
    
    // Verify the development task has the failure details
    const devTask = developmentTask as any;
    assert(devTask.summary?.includes('Fix failing tests'));
    assert(devTask.summary?.includes('TestFailed'));
    
    cleanupDb();
  });

  test('should handle custom test executor behavior', async () => {
    setupDb();
    
    // Create custom executor with specific behavior
    const customExecutor = createCustomTestExecutor(async (worktreePath) => {
      assert(worktreePath.includes('feature/test-branch'), 'Should receive correct worktree path');
      
      return {
        passed: true,
        output: `Tests executed in: ${worktreePath}\nAll tests passed!`,
        errorOutput: undefined
      };
    });
    
    const result = await processTestingTask(1, db, customExecutor);
    
    assert.strictEqual(result.success, true);
    assert(result.summary?.includes('feature/test-branch'));
    assert(result.summary?.includes('All tests passed!'));
    
    cleanupDb();
  });

  test('should preserve previous summary when restarting failed task', async () => {
    setupDb();
    
    // Update the task to have a failed status with existing summary
    db.prepare(`
      UPDATE tasks 
      SET status = 'failed', summary = 'Previous attempt failed: Database connection error'
      WHERE id = 1
    `).run();
    
    // Create custom executor that passes
    const customExecutor = createCustomTestExecutor(async () => ({
      passed: true,
      output: 'All tests now pass after fixing database issue',
      errorOutput: undefined
    }));
    
    const result = await processTestingTask(1, db, customExecutor);
    
    assert.strictEqual(result.success, true);
    
    // Verify summary contains both previous and new information
    assert(result.summary?.includes('Previous attempt failed: Database connection error'));
    assert(result.summary?.includes('--- Latest Progress ---'));
    assert(result.summary?.includes('All tests now pass after fixing database issue'));
    
    // Check database was updated correctly
    const updatedTask = db.prepare('SELECT summary FROM tasks WHERE id = 1').get();
    assert(updatedTask.summary.includes('Previous attempt failed: Database connection error'));
    assert(updatedTask.summary.includes('--- Latest Progress ---'));
    assert(updatedTask.summary.includes('All tests now pass after fixing database issue'));
    
    cleanupDb();
  });
});