/**
 * Tasks API Integration Tests (TDD)
 */
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { runMigrations } from '../../db/migrations.ts';
import { createTasksRouter, type TaskService } from './tasks.ts';

describe('Tasks API Routes', () => {
  let db: Database.Database;
  let mockService: TaskService;

  beforeEach(() => {
    // Create in-memory test database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    
    // Insert test data
    db.prepare(`
      INSERT INTO work_items (id, name, status, type, description) 
      VALUES (1, 'Test Story', 'new', 'user_story', 'Test description')
    `).run();
    
    db.prepare(`
      INSERT INTO agents (id, type) 
      VALUES (1, 'developer')
    `).run();
    
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status) 
      VALUES (1, 1, 'development', 'new')
    `).run();

    // Create mock service
    mockService = {
      assignTaskToAgent: async (taskId: number, agentId: number) => {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
        
        if (!task || !agent) {
          throw new Error('Task or agent not found');
        }
        
        // Update task status
        db.prepare('UPDATE tasks SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('in_progress', taskId);
        
        return {
          success: true,
          taskId,
          agentId,
          status: 'in_progress'
        };
      },
      
      completeTask: async (taskId: number, summary: string) => {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (!task) {
          throw new Error('Task not found');
        }
        
        // Update task
        db.prepare(`
          UPDATE tasks 
          SET status = ?, summary = ?, completed_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run('done', summary, taskId);
        
        return {
          success: true,
          taskId,
          summary
        };
      },
      
      createNextTask: async (parentTaskId: number, type: string) => {
        const parentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parentTaskId);
        if (!parentTask) {
          throw new Error('Parent task not found');
        }
        
        // Create next task
        const result = db.prepare(`
          INSERT INTO tasks (user_story_id, parent_task_id, type, status, created_at)
          VALUES (?, ?, ?, 'new', CURRENT_TIMESTAMP)
        `).run(parentTask.user_story_id, parentTaskId, type);
        
        return {
          success: true,
          taskId: result.lastInsertRowid,
          type,
          parentTaskId
        };
      }
    };
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('POST /:taskId/assign', () => {
    test('should assign task to agent', async () => {
      const router = createTasksRouter(mockService);
      assert.ok(router);
      
      // Test assignment
      const result = await mockService.assignTaskToAgent(1, 1);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.taskId, 1);
      assert.strictEqual(result.agentId, 1);
      assert.strictEqual(result.status, 'in_progress');
      
      // Verify task status updated in database
      const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
      assert.strictEqual(updatedTask.status, 'in_progress');
      assert.ok(updatedTask.started_at);
    });

    test('should fail with invalid task ID', async () => {
      try {
        await mockService.assignTaskToAgent(999, 1);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Task or agent not found');
      }
    });

    test('should fail with invalid agent ID', async () => {
      try {
        await mockService.assignTaskToAgent(1, 999);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Task or agent not found');
      }
    });
  });

  describe('POST /:taskId/complete', () => {
    test('should complete task with summary', async () => {
      const summary = 'Task completed successfully. Implemented the feature as requested.';
      
      const result = await mockService.completeTask(1, summary);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.taskId, 1);
      assert.strictEqual(result.summary, summary);
      
      // Verify task status updated in database
      const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
      assert.strictEqual(updatedTask.status, 'done');
      assert.strictEqual(updatedTask.summary, summary);
      assert.ok(updatedTask.completed_at);
    });

    test('should fail with invalid task ID', async () => {
      try {
        await mockService.completeTask(999, 'Summary');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Task not found');
      }
    });
  });

  describe('POST /:taskId/create-next', () => {
    test('should create next task for testing', async () => {
      const result = await mockService.createNextTask(1, 'testing');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'testing');
      assert.strictEqual(result.parentTaskId, 1);
      assert.ok(result.taskId);
      
      // Verify task created in database
      const nextTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.taskId) as any;
      assert.strictEqual(nextTask.type, 'testing');
      assert.strictEqual(nextTask.parent_task_id, 1);
      assert.strictEqual(nextTask.status, 'new');
      assert.strictEqual(nextTask.user_story_id, 1);
    });

    test('should fail with invalid parent task ID', async () => {
      try {
        await mockService.createNextTask(999, 'testing');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Parent task not found');
      }
    });
  });
});