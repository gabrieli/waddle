/**
 * Generic Task Creation API Tests
 * 
 * Tests for the POST /api/tasks endpoint
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import express from 'express';
import { createTaskService } from '../../services/task-service.ts';
import { createTasksRouter } from './tasks.ts';
import { runMigrations } from '../../db/migrations.ts';

// Simple test helper for making requests
async function makeRequest(app: express.Application, method: string, path: string, body?: any) {
  const http = await import('http');
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = (server.address() as any).port;
      const options = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          server.close();
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
          });
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

describe('Generic Task Creation API', () => {
  let db: Database.Database;
  let app: express.Application;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations to set up schema
    runMigrations(db);
    
    // Set up test data
    setupTestData();
    
    // Create Express app with routes
    const taskService = createTaskService(db);
    app = express();
    app.use(express.json());
    app.use('/api/tasks', createTasksRouter(taskService));
  });

  afterEach(() => {
    db.close();
  });

  function setupTestData() {
    // Create test user stories
    db.prepare(`
      INSERT INTO work_items (id, name, status, description, type, version, created_at, updated_at)
      VALUES (1, 'Test Story 1', 'new', 'Test', 'user_story', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // Create an existing task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'development', 'done', 'feature/test', CURRENT_TIMESTAMP)
    `).run();
  }

  describe('POST /api/tasks', () => {
    it('should create task with user_story_id', async () => {
      const response = await makeRequest(app, 'POST', '/api/tasks', {
        type: 'development',
        user_story_id: 1,
        branch_name: 'feature/new-task'
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.type, 'development');
      assert.strictEqual(response.body.userStoryId, 1);
      assert(response.body.taskId);

      // Verify in database
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(response.body.taskId);
      assert.strictEqual(task.type, 'development');
      assert.strictEqual(task.user_story_id, 1);
      assert.strictEqual(task.branch_name, 'feature/new-task');
    });

    it('should create task with parent_task_id', async () => {
      const response = await makeRequest(app, 'POST', '/api/tasks', {
        type: 'testing',
        parent_task_id: 1
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.type, 'testing');
      assert.strictEqual(response.body.parentTaskId, 1);
      assert.strictEqual(response.body.userStoryId, 1); // Inherited

      // Verify inheritance
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(response.body.taskId);
      assert.strictEqual(task.parent_task_id, 1);
      assert.strictEqual(task.branch_name, 'feature/test'); // Inherited
    });

    it('should return 400 when type is missing', async () => {
      const response = await makeRequest(app, 'POST', '/api/tasks', {
        user_story_id: 1
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.error, 'type is required');
    });

    it('should return 400 for invalid task type', async () => {
      const response = await makeRequest(app, 'POST', '/api/tasks', {
        type: 'invalid',
        user_story_id: 1
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert(response.body.error.includes('Invalid task type'));
    });

    it('should return 400 when neither user_story_id nor parent_task_id provided', async () => {
      const response = await makeRequest(app, 'POST', '/api/tasks', {
        type: 'development'
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert(response.body.error.includes('Either user_story_id or parent_task_id must be provided'));
    });

    it('should handle all valid task types', async () => {
      const types = ['development', 'testing', 'review'];
      
      for (const type of types) {
        const response = await makeRequest(app, 'POST', '/api/tasks', {
          type,
          user_story_id: 1
        });

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.type, type);
      }
    });

    it('should create task chain', async () => {
      // Create development task
      const dev = await makeRequest(app, 'POST', '/api/tasks', {
        type: 'development',
        user_story_id: 1,
        branch_name: 'feature/task-chain'
      });

      assert.strictEqual(dev.status, 200);

      // Create testing task with parent
      const test = await makeRequest(app, 'POST', '/api/tasks', {
        type: 'testing',
        parent_task_id: dev.body.taskId
      });

      assert.strictEqual(test.status, 200);
      assert.strictEqual(test.body.parentTaskId, dev.body.taskId);

      // Create review task
      const review = await makeRequest(app, 'POST', '/api/tasks', {
        type: 'review',
        parent_task_id: test.body.taskId
      });

      assert.strictEqual(review.status, 200);
      assert.strictEqual(review.body.parentTaskId, test.body.taskId);
    });
  });
});