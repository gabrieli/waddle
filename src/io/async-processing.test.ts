/**
 * End-to-End Async Task Processing Tests
 * 
 * Tests the complete async task processing flow including:
 * - Task creation via services
 * - Background processing initiation
 * - Task status transitions
 * - Error handling
 * - Timeout scenarios
 * - Concurrent task processing
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { runMigrations } from './db/migrations.ts';
import { createTaskService } from './services/task-service.ts';
import { processDevelopmentTask } from './processors/development-processor.ts';
import { processTestingTask } from './processors/testing-processor.ts';
import { createMockTestExecutor } from './processors/test-executors.ts';
import { processReviewTask } from './processors/review-processor.ts';
import { setMockResult, resetMockCapture } from './processors/__mocks__/claude-client.ts';
import * as mockClaudeClient from './processors/__mocks__/claude-client.ts';

describe('Async Task Processing End-to-End', () => {
  let db: Database.Database;
  let taskService: any;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations to set up schema
    runMigrations(db);
    
    // Set up test data
    setupTestData();
    
    // Create task service
    taskService = createTaskService(db);
    
    // Reset mock to success state
    setMockResult({ success: true, output: 'Task completed successfully' });
    resetMockCapture();
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
  }

  function waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  describe('Async Task Processing Flow', () => {
    it('should process development task asynchronously', async () => {
      // Create a development task
      const createResult = await taskService.createTask({
        type: 'development',
        work_item_id: 1,
        branch_name: 'feature/async-test'
      });

      assert.strictEqual(createResult.success, true);
      const taskId = createResult.taskId;

      // Verify task is created with 'new' status
      const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      assert.strictEqual(newTask.status, 'new');
      assert.strictEqual(newTask.started_at, null);
      assert.strictEqual(newTask.completed_at, null);

      // Mark task as in progress to simulate API behavior
      db.prepare(`
        UPDATE tasks 
        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(taskId);

      // Process the task asynchronously (this simulates background processing)
      const processResult = await processDevelopmentTask(taskId, db, mockClaudeClient);

      assert.strictEqual(processResult.success, true);
      assert.strictEqual(processResult.summary, 'Task completed successfully');

      // Verify task completed successfully
      const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      assert.strictEqual(completedTask.status, 'done');
      assert.strictEqual(completedTask.summary, 'Task completed successfully');
      assert(completedTask.completed_at, 'completed_at should be set');

      // Verify work item status updated
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(1);
      assert.strictEqual(workItem.status, 'in_progress');

      // Verify testing task was created
      const testingTask = db.prepare('SELECT * FROM tasks WHERE user_story_id = ? AND type = ?').get(1, 'testing');
      assert(testingTask, 'Testing task should be created');
      assert.strictEqual(testingTask.status, 'new');
      assert.strictEqual(testingTask.branch_name, 'feature/async-test');
    });

    it('should handle task processing failure gracefully', async () => {
      // Set mock to fail
      setMockResult({ success: false, error: 'Claude execution failed' });

      // Create a development task
      const createResult = await taskService.createTask({
        type: 'development',
        work_item_id: 1
      });

      const taskId = createResult.taskId;

      // Process the task (will fail)
      const processResult = await processDevelopmentTask(taskId, db, mockClaudeClient);

      // Verify processor result indicates failure
      assert.strictEqual(processResult.success, false);
      assert.strictEqual(processResult.error, 'Claude execution failed');

      // Verify work item status NOT updated on failure
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(1);
      assert.strictEqual(workItem.status, 'new');

      // Verify no testing task was created on failure
      const testingTask = db.prepare('SELECT * FROM tasks WHERE user_story_id = ? AND type = ?').get(1, 'testing');
      assert.strictEqual(testingTask, undefined);
    });

    it('should allow retrying failed tasks', async () => {
      // Set mock to fail initially
      setMockResult({ success: false, error: 'Initial failure' });

      // Create a development task
      const createResult = await taskService.createTask({
        type: 'development',
        work_item_id: 1
      });

      const taskId = createResult.taskId;

      // Process task (will fail)
      let processResult = await processDevelopmentTask(taskId, db, mockClaudeClient);
      assert.strictEqual(processResult.success, false);
      assert.strictEqual(processResult.error, 'Initial failure');

      // Set mock to succeed for retry
      setMockResult({ success: true, output: 'Task completed on retry' });

      // Retry the failed task
      processResult = await processDevelopmentTask(taskId, db, mockClaudeClient);

      // Verify task completed successfully on retry
      assert.strictEqual(processResult.success, true);
      assert.strictEqual(processResult.summary, 'Task completed on retry');

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      assert.strictEqual(task.status, 'done');
      assert.strictEqual(task.summary, 'Task completed on retry');
    });

  });

  describe('Concurrent Task Processing', () => {
    it('should handle multiple tasks processing concurrently', async () => {
      // Create multiple tasks
      const task1Result = await taskService.createTask({
        type: 'development',
        work_item_id: 1,
        branch_name: 'feature/task-1'
      });

      const task2Result = await taskService.createTask({
        type: 'testing',
        work_item_id: 1,
        branch_name: 'feature/task-2'
      });

      const taskId1 = task1Result.taskId;
      const taskId2 = task2Result.taskId;

      // Process both tasks concurrently
      const [process1Result, process2Result] = await Promise.all([
        processDevelopmentTask(taskId1, db, mockClaudeClient),
        processTestingTask(taskId2, db, createMockTestExecutor()) // Use mock executor for testing
      ]);

      // Verify both tasks completed successfully
      assert.strictEqual(process1Result.success, true);
      assert.strictEqual(process2Result.success, true);

      const completedTask1 = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId1);
      const completedTask2 = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId2);

      assert.strictEqual(completedTask1.status, 'done');
      assert.strictEqual(completedTask2.status, 'done');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing task gracefully', async () => {
      const result = await processDevelopmentTask(999, db, mockClaudeClient);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Task not found');
    });

    it('should handle unexpected processing errors', async () => {
      // Create a task
      const createResult = await taskService.createTask({
        type: 'development',
        work_item_id: 1
      });

      const taskId = createResult.taskId;

      // Simulate an unexpected error by setting undefined error
      setMockResult({ success: false, error: undefined });

      const processResult = await processDevelopmentTask(taskId, db, mockClaudeClient);

      // Verify task processing failed gracefully
      assert.strictEqual(processResult.success, false);
      assert(processResult.error, 'Should have error message');
    });
  });

  describe('Task Type Processing', () => {
    it('should process testing tasks correctly', async () => {
      // Create a testing task with branch_name
      const createResult = await taskService.createTask({
        type: 'testing',
        work_item_id: 1,
        branch_name: 'feature/async-test'
      });

      const taskId = createResult.taskId;

      // Use mock executor to simulate successful tests
      const processResult = await processTestingTask(taskId, db, createMockTestExecutor());

      // Verify task completed (even if tests failed, the processor should complete)
      assert.strictEqual(processResult.success, true);

      // Verify task was marked as done
      const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      assert.strictEqual(completedTask.status, 'done');
      assert(completedTask.summary, 'Should have summary of test results');

      // Verify a follow-up task was created (either review if tests passed, or development if failed)
      const followUpTasks = db.prepare('SELECT * FROM tasks WHERE user_story_id = ? AND id != ?').all(1, taskId);
      assert(followUpTasks.length > 0, 'Should create follow-up task');
    });

    it('should process review tasks correctly', async () => {
      // Create a review task
      const createResult = await taskService.createTask({
        type: 'review',
        work_item_id: 1
      });

      const taskId = createResult.taskId;

      // Set mock to approve review with correct format
      setMockResult({ success: true, output: 'The code quality is excellent and meets all requirements.\n\nREVIEW OUTCOME: APPROVED' });

      // Process the review task
      const processResult = await processReviewTask(taskId, db, mockClaudeClient);

      assert.strictEqual(processResult.success, true);

      // Verify task completed
      const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      assert.strictEqual(completedTask.status, 'done');

      // Verify work item marked as done for approved review
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(1);
      assert.strictEqual(workItem.status, 'done');
    });
  });
});