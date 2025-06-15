/**
 * Task repository tests for Waddle
 */

import { Database } from '../index';
import { TaskRepository } from './task-repository';
import * as fs from 'fs';

describe('TaskRepository', () => {
  let db: Database;
  let repo: TaskRepository;
  const testDbPath = './test-task-repo.db';
  let testFeatureId: string;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
    await db.initialize();
    repo = db.tasks;

    // Create a test feature
    const feature = db.features.create({ description: 'Test feature' });
    testFeatureId = feature.id;
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('create', () => {
    it('should create a task with default values', () => {
      const task = repo.create({
        featureId: testFeatureId,
        role: 'architect',
        description: 'Design the system'
      });

      expect(task.id).toBeDefined();
      expect(task.featureId).toBe(testFeatureId);
      expect(task.role).toBe('architect');
      expect(task.description).toBe('Design the system');
      expect(task.status).toBe('pending');
      expect(task.attempts).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('should find an existing task', () => {
      const created = repo.create({
        featureId: testFeatureId,
        role: 'developer',
        description: 'Implement feature'
      });

      const found = repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.description).toBe('Implement feature');
    });

    it('should return null for non-existent task', () => {
      const found = repo.findById(999999);
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      // Create test tasks
      repo.create({ featureId: testFeatureId, role: 'architect', description: 'Task 1' });
      repo.create({ featureId: testFeatureId, role: 'developer', description: 'Task 2' });
      repo.create({ featureId: testFeatureId, role: 'reviewer', description: 'Task 3' });
      
      // Create another feature with tasks
      const feature2 = db.features.create({ description: 'Feature 2' });
      repo.create({ featureId: feature2.id, role: 'architect', description: 'Task 4' });
    });

    it('should find all tasks', () => {
      const tasks = repo.findAll();
      expect(tasks).toHaveLength(4);
    });

    it('should filter by featureId', () => {
      const tasks = repo.findAll({ featureId: testFeatureId });
      expect(tasks).toHaveLength(3);
    });

    it('should filter by role', () => {
      const architects = repo.findAll({ role: 'architect' });
      expect(architects).toHaveLength(2);
    });

    it('should filter by status', () => {
      const task = repo.create({
        featureId: testFeatureId,
        role: 'developer',
        description: 'In progress task'
      });
      repo.update(task.id, { status: 'in_progress' });

      const pending = repo.findAll({ status: 'pending' });
      const inProgress = repo.findAll({ status: 'in_progress' });

      expect(pending).toHaveLength(4);
      expect(inProgress).toHaveLength(1);
    });

    it('should filter by multiple statuses', () => {
      const task1 = repo.findAll()[0];
      const task2 = repo.findAll()[1];
      
      repo.update(task1.id, { status: 'in_progress' });
      repo.update(task2.id, { status: 'complete' });

      const tasks = repo.findAll({ status: ['in_progress', 'complete'] });
      expect(tasks).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update task fields', () => {
      const task = repo.create({
        featureId: testFeatureId,
        role: 'developer',
        description: 'Original task'
      });

      const now = new Date();
      const updated = repo.update(task.id, {
        status: 'in_progress',
        attempts: 1,
        startedAt: now
      });

      expect(updated.status).toBe('in_progress');
      expect(updated.attempts).toBe(1);
      expect(updated.startedAt).toEqual(now);
    });

    it('should update output and completion', () => {
      const task = repo.create({
        featureId: testFeatureId,
        role: 'architect',
        description: 'Design task'
      });

      const output = { design: 'Architecture document', diagrams: ['system.png'] };
      const updated = repo.update(task.id, {
        status: 'complete',
        completedAt: new Date(),
        output
      });

      expect(updated.status).toBe('complete');
      expect(updated.completedAt).toBeInstanceOf(Date);
      expect(updated.output).toEqual(output);
    });

    it('should update error on failure', () => {
      const task = repo.create({
        featureId: testFeatureId,
        role: 'developer',
        description: 'Failing task'
      });

      const updated = repo.update(task.id, {
        status: 'failed',
        error: 'Command execution failed'
      });

      expect(updated.status).toBe('failed');
      expect(updated.error).toBe('Command execution failed');
    });
  });

  describe('delete', () => {
    it('should delete an existing task', () => {
      const task = repo.create({
        featureId: testFeatureId,
        role: 'architect',
        description: 'Delete me'
      });

      repo.delete(task.id);
      const found = repo.findById(task.id);
      expect(found).toBeNull();
    });

    it('should throw for non-existent task', () => {
      expect(() => {
        repo.delete(999999);
      }).toThrow('Task not found');
    });
  });

  describe('findByFeatureId', () => {
    it('should find all tasks for a feature', () => {
      repo.create({ featureId: testFeatureId, role: 'architect', description: 'Task 1' });
      repo.create({ featureId: testFeatureId, role: 'developer', description: 'Task 2' });

      const tasks = repo.findByFeatureId(testFeatureId);
      expect(tasks).toHaveLength(2);
      expect(tasks.every(t => t.featureId === testFeatureId)).toBe(true);
    });
  });

  describe('findPendingTasks', () => {
    it('should find only pending tasks', () => {
      repo.create({ featureId: testFeatureId, role: 'architect', description: 'Pending 1' });
      repo.create({ featureId: testFeatureId, role: 'developer', description: 'Pending 2' });
      const task3 = repo.create({ featureId: testFeatureId, role: 'reviewer', description: 'In progress' });

      repo.update(task3.id, { status: 'in_progress' });

      const pending = repo.findPendingTasks();
      expect(pending).toHaveLength(2);
      expect(pending.every(t => t.status === 'pending')).toBe(true);
    });

    it('should respect limit', () => {
      for (let i = 0; i < 5; i++) {
        repo.create({ featureId: testFeatureId, role: 'developer', description: `Task ${i}` });
      }

      const pending = repo.findPendingTasks(3);
      expect(pending).toHaveLength(3);
    });
  });

  describe('incrementAttempts', () => {
    it('should increment task attempts', () => {
      const task = repo.create({
        featureId: testFeatureId,
        role: 'developer',
        description: 'Retry task'
      });

      expect(task.attempts).toBe(0);

      repo.incrementAttempts(task.id);
      const updated1 = repo.findById(task.id);
      expect(updated1?.attempts).toBe(1);

      repo.incrementAttempts(task.id);
      const updated2 = repo.findById(task.id);
      expect(updated2?.attempts).toBe(2);
    });
  });
});