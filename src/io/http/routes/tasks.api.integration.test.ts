/**
 * API Integration Tests for Task Assignment
 * 
 * These tests verify the complete API flow including HTTP endpoints
 * with AI task processing.
 */

import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { createTaskService } from '../../services/task-service.ts';
import { createAITaskHandler } from '../../services/ai-task-handler.ts';
import { createTasksRouter } from './tasks.ts';
import { runMigrations } from '../../db/migrations.ts';

describe('Task Assignment API Integration Tests', () => {
  let db: Database.Database;
  let app: express.Application;
  let taskService: ReturnType<typeof createTaskService>;
  let aiHandler: ReturnType<typeof createAITaskHandler>;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations to set up schema
    runMigrations(db);
    
    // Set up test data
    await setupTestData();
    
    // Create services
    taskService = createTaskService(db);
    aiHandler = createAITaskHandler();
    
    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/tasks', createTasksRouter(taskService));
  });

  afterEach(() => {
    db.close();
  });

  async function setupTestData() {
    // Create test user stories
    db.prepare(`
      INSERT INTO work_items (id, name, status, description, type, version, created_at, updated_at)
      VALUES (1, 'Math Operations Test', 'new', 'Test mathematical operations', 'user_story', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // Create test tasks
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'development', 'new', 'feature/test-math', CURRENT_TIMESTAMP)
    `).run();

    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (2, 1, 'development', 'new', 'feature/test-text', CURRENT_TIMESTAMP)
    `).run();
  }

  describe('Complete API Flow with AI Processing', () => {
    it('should handle 2+2 task via API endpoints', async () => {
      // Step 1: Assign task via API
      const assignResponse = await request(app)
        .post('/api/tasks/1/assign')
        .send({})
        .expect(200);

      expect(assignResponse.body.success).toBe(true);
      expect(assignResponse.body.taskId).toBe(1);
      expect(assignResponse.body.status).toBe('in_progress');

      // Step 2: Simulate AI processing
      const aiResult = await aiHandler.processTask('2+2');
      expect(aiResult.success).toBe(true);
      expect(aiResult.result).toBe('2 + 2 = 4');

      // Step 3: Complete task via API
      const completeResponse = await request(app)
        .post('/api/tasks/1/complete')
        .send({ summary: aiResult.result })
        .expect(200);

      expect(completeResponse.body.success).toBe(true);
      expect(completeResponse.body.taskId).toBe(1);
      expect(completeResponse.body.summary).toBe('2 + 2 = 4');

      // Verify final state in database
      const finalTask = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      expect(finalTask.status).toBe('done');
      expect(finalTask.summary).toBe('2 + 2 = 4');
    });

    it('should handle complex math operations (15*3)', async () => {
      // Assign task
      await request(app)
        .post('/api/tasks/1/assign')
        .send({})
        .expect(200);

      // Process with AI
      const aiResult = await aiHandler.processTask('15*3');
      expect(aiResult.result).toBe('15 * 3 = 45');

      // Complete task
      const completeResponse = await request(app)
        .post('/api/tasks/1/complete')
        .send({ summary: aiResult.result })
        .expect(200);

      expect(completeResponse.body.summary).toBe('15 * 3 = 45');
    });

    it('should handle text-based tasks via API', async () => {
      // Assign task
      await request(app)
        .post('/api/tasks/2/assign')
        .send({})
        .expect(200);

      // Process with AI
      const aiResult = await aiHandler.processTask('hello world');
      expect(aiResult.result).toBe('Hello! Task processed successfully.');

      // Complete task
      await request(app)
        .post('/api/tasks/2/complete')
        .send({ summary: aiResult.result })
        .expect(200);

      // Verify in database
      const task = db.prepare('SELECT * FROM tasks WHERE id = 2').get();
      expect(task.summary).toBe('Hello! Task processed successfully.');
    });

    it('should handle multiple tasks in sequence', async () => {
      // Process first task (2+2)
      await request(app).post('/api/tasks/1/assign').send({}).expect(200);
      const ai1 = await aiHandler.processTask('2+2');
      await request(app).post('/api/tasks/1/complete').send({ summary: ai1.result }).expect(200);

      // Process second task (hello)
      await request(app).post('/api/tasks/2/assign').send({}).expect(200);
      const ai2 = await aiHandler.processTask('hello test');
      await request(app).post('/api/tasks/2/complete').send({ summary: ai2.result }).expect(200);

      // Verify both tasks completed
      const task1 = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      const task2 = db.prepare('SELECT * FROM tasks WHERE id = 2').get();
      
      expect(task1.status).toBe('done');
      expect(task1.summary).toBe('2 + 2 = 4');
      expect(task2.status).toBe('done');
      expect(task2.summary).toBe('Hello! Task processed successfully.');
    });
  });

  describe('API Error Handling', () => {
    it('should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .post('/api/tasks/invalid/assign')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('taskId is required');
    });

    it('should return 400 for non-existent task', async () => {
      const response = await request(app)
        .post('/api/tasks/999/assign')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 for already assigned task', async () => {
      // Assign task first
      await request(app)
        .post('/api/tasks/1/assign')
        .send({})
        .expect(200);

      // Try to assign again
      const response = await request(app)
        .post('/api/tasks/1/assign')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Task is not available for assignment');
    });

    it('should return 400 for completing unassigned task', async () => {
      const response = await request(app)
        .post('/api/tasks/1/complete')
        .send({ summary: 'test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Task is not in progress');
    });

    it('should return 400 for completing task without summary', async () => {
      // Assign task first
      await request(app)
        .post('/api/tasks/1/assign')
        .send({})
        .expect(200);

      // Try to complete without summary
      const response = await request(app)
        .post('/api/tasks/1/complete')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('taskId and summary are required');
    });
  });

  describe('Task State Validation', () => {
    it('should track timestamps correctly', async () => {
      const beforeAssign = new Date();
      
      // Assign task
      await request(app)
        .post('/api/tasks/1/assign')
        .send({})
        .expect(200);

      const afterAssign = new Date();
      
      // Check started_at timestamp
      const taskAfterAssign = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      const startedAt = new Date(taskAfterAssign.started_at);
      expect(startedAt >= beforeAssign).toBe(true);
      expect(startedAt <= afterAssign).toBe(true);

      // Complete task
      const beforeComplete = new Date();
      await request(app)
        .post('/api/tasks/1/complete')
        .send({ summary: 'completed' })
        .expect(200);
      const afterComplete = new Date();

      // Check completed_at timestamp
      const taskAfterComplete = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      const completedAt = new Date(taskAfterComplete.completed_at);
      expect(completedAt >= beforeComplete).toBe(true);
      expect(completedAt <= afterComplete).toBe(true);
    });
  });
});