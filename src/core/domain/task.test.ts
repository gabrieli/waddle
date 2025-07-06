import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  TaskType, 
  TaskStatus,
  createTask,
  isValidTaskType,
  isValidTaskStatus
} from './task.ts';
import type { Task } from './task.ts';

describe('Task Domain', () => {
  describe('Validation Functions', () => {
    it('isValidTaskType should validate task types', () => {
      assert.strictEqual(isValidTaskType('development'), true);
      assert.strictEqual(isValidTaskType('testing'), true);
      assert.strictEqual(isValidTaskType('review'), true);
      assert.strictEqual(isValidTaskType('invalid'), false);
      assert.strictEqual(isValidTaskType(''), false);
      assert.strictEqual(isValidTaskType(null as any), false);
    });

    it('isValidTaskStatus should validate task statuses', () => {
      assert.strictEqual(isValidTaskStatus('new'), true);
      assert.strictEqual(isValidTaskStatus('in_progress'), true);
      assert.strictEqual(isValidTaskStatus('done'), true);
      assert.strictEqual(isValidTaskStatus('invalid'), false);
      assert.strictEqual(isValidTaskStatus(''), false);
      assert.strictEqual(isValidTaskStatus(null as any), false);
    });
  });

  describe('Factory Functions', () => {
    it('createTask should create task with correct defaults', () => {
      const task = createTask({
        user_story_id: 1,
        type: 'development'
      });

      assert.strictEqual(task.user_story_id, 1);
      assert.strictEqual(task.type, 'development');
      assert.strictEqual(task.status, 'new');
      assert.strictEqual(task.parent_task_id, undefined);
      assert.strictEqual(task.summary, undefined);
      assert.strictEqual(task.metadata, undefined);
      assert(task.created_at instanceof Date);
      assert.strictEqual(task.started_at, undefined);
      assert.strictEqual(task.completed_at, undefined);
    });

    it('createTask should support parent task reference', () => {
      const task = createTask({
        user_story_id: 1,
        type: 'testing',
        parent_task_id: 42
      });

      assert.strictEqual(task.parent_task_id, 42);
      assert.strictEqual(task.type, 'testing');
    });

    it('createTask should validate task type', () => {
      assert.throws(() => {
        createTask({
          user_story_id: 1,
          type: 'invalid' as any
        });
      }, /Invalid task type/);
    });

    it('createTask should support all optional fields', () => {
      const metadata = { test: 'data' };
      const task = createTask({
        user_story_id: 1,
        type: 'review',
        parent_task_id: 10,
        summary: 'Test summary',
        metadata,
        branch_name: 'feature/test-branch'
      });

      assert.strictEqual(task.summary, 'Test summary');
      assert.deepStrictEqual(task.metadata, metadata);
      assert.strictEqual(task.branch_name, 'feature/test-branch');
    });

    it('createTask should support branch_name', () => {
      const task = createTask({
        user_story_id: 1,
        type: 'development',
        branch_name: 'feature/us-002-task-assignment'
      });

      assert.strictEqual(task.branch_name, 'feature/us-002-task-assignment');
    });
  });

  describe('Task Type Definitions', () => {
    it('should have correct TaskType values', () => {
      assert.strictEqual(TaskType.DEVELOPMENT, 'development');
      assert.strictEqual(TaskType.TESTING, 'testing');
      assert.strictEqual(TaskType.REVIEW, 'review');
    });

    it('should have correct TaskStatus values', () => {
      assert.strictEqual(TaskStatus.NEW, 'new');
      assert.strictEqual(TaskStatus.IN_PROGRESS, 'in_progress');
      assert.strictEqual(TaskStatus.DONE, 'done');
    });
  });
});