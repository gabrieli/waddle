/**
 * Generic Task Creation Tests
 * 
 * Tests for the new generic createTask functionality
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { createTaskService } from './task-service.ts';
import { runMigrations } from '../db/migrations.ts';

describe('Generic Task Creation', () => {
  let db: Database.Database;
  let taskService: ReturnType<typeof createTaskService>;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations to set up schema
    runMigrations(db);
    
    // Set up test data
    setupTestData();
    
    // Create service
    taskService = createTaskService(db);
  });

  afterEach(() => {
    db.close();
  });

  function setupTestData() {
    // Create test user stories
    db.prepare(`
      INSERT INTO work_items (id, name, status, description, type, version, created_at, updated_at)
      VALUES (1, 'Test User Story', 'new', 'Test description', 'user_story', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
    
    db.prepare(`
      INSERT INTO work_items (id, name, status, description, type, version, created_at, updated_at)
      VALUES (2, 'Another User Story', 'new', 'Another test', 'user_story', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // Create an existing task to use as parent
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'development', 'done', 'feature/test-branch', CURRENT_TIMESTAMP)
    `).run();
  }

  describe('Task creation with only type and user_story_id', () => {
    it('should create a development task with user_story_id', async () => {
      const result = await taskService.createTask({
        type: 'development',
        user_story_id: 1
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'development');
      assert.strictEqual(result.userStoryId, 1);
      assert.strictEqual(result.parentTaskId, undefined);

      // Verify in database
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.taskId);
      assert.strictEqual(task.type, 'development');
      assert.strictEqual(task.user_story_id, 1);
      assert.strictEqual(task.parent_task_id, null);
      assert.strictEqual(task.status, 'new');
    });

    it('should create a testing task with user_story_id and branch_name', async () => {
      const result = await taskService.createTask({
        type: 'testing',
        user_story_id: 1,
        branch_name: 'feature/custom-branch'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'testing');
      assert.strictEqual(result.userStoryId, 1);

      // Verify branch name in database
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.taskId);
      assert.strictEqual(task.branch_name, 'feature/custom-branch');
    });
  });

  describe('Task creation with parent_task_id', () => {
    it('should create a testing task inheriting from parent', async () => {
      const result = await taskService.createTask({
        type: 'testing',
        parent_task_id: 1
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'testing');
      assert.strictEqual(result.parentTaskId, 1);
      assert.strictEqual(result.userStoryId, 1); // Inherited from parent

      // Verify inheritance in database
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.taskId);
      assert.strictEqual(task.parent_task_id, 1);
      assert.strictEqual(task.user_story_id, 1); // Inherited
      assert.strictEqual(task.branch_name, 'feature/test-branch'); // Inherited
    });

    it('should allow overriding inherited values', async () => {
      const result = await taskService.createTask({
        type: 'testing',
        parent_task_id: 1,
        user_story_id: 2, // Override parent's user_story_id
        branch_name: 'feature/override-branch' // Override parent's branch
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.userStoryId, 2); // Overridden

      // Verify overrides in database
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.taskId);
      assert.strictEqual(task.user_story_id, 2);
      assert.strictEqual(task.branch_name, 'feature/override-branch');
    });
  });

  describe('Task type validation', () => {
    it('should accept valid task types', async () => {
      const validTypes = ['development', 'testing', 'review'];
      
      for (const type of validTypes) {
        const result = await taskService.createTask({
          type,
          user_story_id: 1
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.type, type);
      }
    });

    it('should reject invalid task type', async () => {
      await assert.rejects(
        async () => {
          await taskService.createTask({
            type: 'invalid',
            user_story_id: 1
          });
        },
        {
          message: 'Invalid task type: invalid. Must be one of: development, testing, review'
        }
      );
    });
  });

  describe('Parameter validation', () => {
    it('should require either user_story_id or parent_task_id', async () => {
      await assert.rejects(
        async () => {
          await taskService.createTask({
            type: 'development'
            // No user_story_id or parent_task_id
          });
        },
        {
          message: 'Either user_story_id or parent_task_id must be provided'
        }
      );
    });

    it('should reject non-existent parent_task_id', async () => {
      await assert.rejects(
        async () => {
          await taskService.createTask({
            type: 'testing',
            parent_task_id: 999
          });
        },
        {
          message: 'Parent task not found'
        }
      );
    });
  });

  describe('Complex scenarios', () => {
    it('should create a chain of tasks', async () => {
      // Create development task
      const dev = await taskService.createTask({
        type: 'development',
        user_story_id: 1,
        branch_name: 'feature/chain-test'
      });

      // Create testing task as child of dev
      const test = await taskService.createTask({
        type: 'testing',
        parent_task_id: dev.taskId
      });

      // Create review task as child of test
      const review = await taskService.createTask({
        type: 'review',
        parent_task_id: test.taskId
      });

      // Verify the chain
      assert.strictEqual(test.parentTaskId, dev.taskId);
      assert.strictEqual(review.parentTaskId, test.taskId);
      
      // All should have same user_story_id and branch_name
      const testTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(test.taskId);
      const reviewTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(review.taskId);
      
      assert.strictEqual(testTask.user_story_id, 1);
      assert.strictEqual(testTask.branch_name, 'feature/chain-test');
      assert.strictEqual(reviewTask.user_story_id, 1);
      assert.strictEqual(reviewTask.branch_name, 'feature/chain-test');
    });
  });
});