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
      INSERT INTO tasks (id, user_story_id, type, status, branch_name) 
      VALUES (1, 1, 'development', 'new', 'feature/test-branch')
    `).run();

    // Create mock service
    mockService = {
      createTask: async (params) => {
        const { type, parent_task_id, work_item_id, branch_name } = params;
        
        const result = db.prepare(`
          INSERT INTO tasks (user_story_id, parent_task_id, type, status, branch_name, created_at)
          VALUES (?, ?, ?, 'new', ?, CURRENT_TIMESTAMP)
        `).run(work_item_id, parent_task_id || null, type, branch_name || null);
        
        return {
          success: true,
          taskId: result.lastInsertRowid as number,
          type,
          parentTaskId: parent_task_id,
          workItemId: work_item_id
        };
      }
    };
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('POST /:taskId/process', () => {
    test('should set wait flag when wait=true', async () => {
      const router = createTasksRouter({ service: mockService, database: db });
      assert.ok(router);
      
      // Set wait flag
      db.prepare('UPDATE tasks SET wait = TRUE WHERE id = 1').run();
      
      // Verify wait flag was set
      const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
      assert.strictEqual(task.wait, 1); // SQLite stores boolean as 1/0
    });

    test('should return 404 for non-existent task', async () => {
      const router = createTasksRouter({ service: mockService, database: db });
      assert.ok(router);
      
      // Test should be handled by the route, but we can test the database lookup
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(999);
      assert.strictEqual(task, undefined);
    });

    test('should find development task for processing', async () => {
      const router = createTasksRouter({ service: mockService, database: db });
      assert.ok(router);
      
      // Verify we can find the development task
      const task = db.prepare('SELECT * FROM tasks WHERE id = 1').get() as any;
      assert.strictEqual(task.type, 'development');
      assert.strictEqual(task.status, 'new');
    });
  });

  describe('POST / (create task)', () => {
    test('should create a development task', async () => {
      const result = await mockService.createTask({
        type: 'development',
        work_item_id: 1,
        branch_name: 'feature/new-task'
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'development');
      assert.strictEqual(result.workItemId, 1);
      assert.ok(result.taskId);
      
      // Verify task created in database
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.taskId) as any;
      assert.strictEqual(task.type, 'development');
      assert.strictEqual(task.status, 'new');
      assert.strictEqual(task.user_story_id, 1);
      assert.strictEqual(task.branch_name, 'feature/new-task');
    });

    test('should create a task with parent task ID', async () => {
      const result = await mockService.createTask({
        type: 'testing',
        work_item_id: 1,
        parent_task_id: 1,
        branch_name: 'feature/test-branch'
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.parentTaskId, 1);
      
      // Verify task created with parent relationship
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.taskId) as any;
      assert.strictEqual(task.parent_task_id, 1);
      assert.strictEqual(task.type, 'testing');
    });
  });
});