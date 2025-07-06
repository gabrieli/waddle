/**
 * Integration Tests for Task Assignment with AI Communication
 * 
 * These tests verify the complete flow from task assignment through 
 * AI processing to task completion.
 */

import Database from 'better-sqlite3';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { createTaskService } from '../../services/task-service.ts';
import { createAITaskHandler } from '../../services/ai-task-handler.ts';
import { runMigrations } from '../../db/migrations.ts';

describe('Task Assignment Integration Tests', () => {
  let db: Database.Database;
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
  });

  afterEach(() => {
    db.close();
  });

  async function setupTestData() {
    // Create a test user story
    db.prepare(`
      INSERT INTO work_items (id, name, status, description, type, version, created_at, updated_at)
      VALUES (1, 'Test Math Operations', 'new', 'Test mathematical operations', 'user_story', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // Create a test task
    db.prepare(`
      INSERT INTO tasks (id, user_story_id, type, status, branch_name, created_at)
      VALUES (1, 1, 'development', 'new', 'feature/test-math', CURRENT_TIMESTAMP)
    `).run();
  }

  describe('Complete Task Flow with AI', () => {
    it('should handle simple math task (2+2) end-to-end', async () => {
      // Step 1: Assign task
      const assignResult = await taskService.assignTaskToAgent(1);
      
      expect(assignResult.success).toBe(true);
      expect(assignResult.taskId).toBe(1);
      expect(assignResult.status).toBe('in_progress');
      
      // Verify task is marked as in progress
      const taskAfterAssign = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      expect(taskAfterAssign.status).toBe('in_progress');
      expect(taskAfterAssign.started_at).toBeTruthy();

      // Step 2: AI processes the task
      const aiResult = await aiHandler.processTask('2+2');
      
      expect(aiResult.success).toBe(true);
      expect(aiResult.result).toBe('2 + 2 = 4');

      // Step 3: Complete task with AI result
      const completeResult = await taskService.completeTask(1, aiResult.result);
      
      expect(completeResult.success).toBe(true);
      expect(completeResult.taskId).toBe(1);
      expect(completeResult.summary).toBe('2 + 2 = 4');

      // Verify task is marked as completed
      const taskAfterComplete = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      expect(taskAfterComplete.status).toBe('done');
      expect(taskAfterComplete.summary).toBe('2 + 2 = 4');
      expect(taskAfterComplete.completed_at).toBeTruthy();
    });

    it('should handle subtraction task (10-3) end-to-end', async () => {
      // Step 1: Assign task
      await taskService.assignTaskToAgent(1);
      
      // Step 2: AI processes the task
      const aiResult = await aiHandler.processTask('10-3');
      
      expect(aiResult.success).toBe(true);
      expect(aiResult.result).toBe('10 - 3 = 7');

      // Step 3: Complete task with AI result
      const completeResult = await taskService.completeTask(1, aiResult.result);
      
      expect(completeResult.success).toBe(true);
      expect(completeResult.summary).toBe('10 - 3 = 7');
    });

    it('should handle multiplication task (5*6) end-to-end', async () => {
      // Step 1: Assign task
      await taskService.assignTaskToAgent(1);
      
      // Step 2: AI processes the task
      const aiResult = await aiHandler.processTask('5*6');
      
      expect(aiResult.success).toBe(true);
      expect(aiResult.result).toBe('5 * 6 = 30');

      // Step 3: Complete task
      const completeResult = await taskService.completeTask(1, aiResult.result);
      
      expect(completeResult.success).toBe(true);
      expect(completeResult.summary).toBe('5 * 6 = 30');
    });

    it('should handle text-based task (hello) end-to-end', async () => {
      // Step 1: Assign task
      await taskService.assignTaskToAgent(1);
      
      // Step 2: AI processes the task
      const aiResult = await aiHandler.processTask('hello world');
      
      expect(aiResult.success).toBe(true);
      expect(aiResult.result).toBe('Hello! Task processed successfully.');

      // Step 3: Complete task
      const completeResult = await taskService.completeTask(1, aiResult.result);
      
      expect(completeResult.success).toBe(true);
      expect(completeResult.summary).toBe('Hello! Task processed successfully.');
    });

    it('should handle generic task end-to-end', async () => {
      // Step 1: Assign task
      await taskService.assignTaskToAgent(1);
      
      // Step 2: AI processes the task
      const aiResult = await aiHandler.processTask('Create a new feature');
      
      expect(aiResult.success).toBe(true);
      expect(aiResult.result).toBe('Processed task: Create a new feature');

      // Step 3: Complete task
      const completeResult = await taskService.completeTask(1, aiResult.result);
      
      expect(completeResult.success).toBe(true);
      expect(completeResult.summary).toBe('Processed task: Create a new feature');
    });
  });

  describe('Error Handling', () => {
    it('should handle task assignment errors', async () => {
      // Try to assign non-existent task
      await expect(taskService.assignTaskToAgent(999)).rejects.toThrow('Task not found');
    });

    it('should handle task completion errors', async () => {
      // Try to complete task that hasn't been assigned
      await expect(taskService.completeTask(1, 'some summary')).rejects.toThrow('Task is not in progress');
    });

    it('should handle already assigned task', async () => {
      // Assign task first
      await taskService.assignTaskToAgent(1);
      
      // Try to assign again
      await expect(taskService.assignTaskToAgent(1)).rejects.toThrow('Task is not available for assignment');
    });
  });

  describe('Task State Transitions', () => {
    it('should track correct state transitions', async () => {
      // Initial state
      let task = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      expect(task.status).toBe('new');
      expect(task.started_at).toBeNull();
      expect(task.completed_at).toBeNull();

      // After assignment
      await taskService.assignTaskToAgent(1);
      task = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      expect(task.status).toBe('in_progress');
      expect(task.started_at).toBeTruthy();
      expect(task.completed_at).toBeNull();

      // After completion
      await taskService.completeTask(1, 'Task completed');
      task = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
      expect(task.status).toBe('done');
      expect(task.started_at).toBeTruthy();
      expect(task.completed_at).toBeTruthy();
      expect(task.summary).toBe('Task completed');
    });
  });
});