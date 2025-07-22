/**
 * Tests for Work Item Service Delete Functionality
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { createWorkItemService } from './work-item-service.ts';
import { runMigrations } from '../db/migrations.ts';

describe('Work Item Service - Delete Functionality', () => {
  let db: Database.Database;
  let service: ReturnType<typeof createWorkItemService>;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations to set up schema
    runMigrations(db);
    
    service = createWorkItemService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('deleteWorkItem', () => {
    it('should delete work item and return success message', async () => {
      // Create a test work item
      const createResult = await service.createWorkItem({
        name: 'Test Work Item',
        description: 'Test description',
        type: 'bug',
        assigned_to: 'developer'
      });

      assert.strictEqual(createResult.success, true);
      const workItemId = createResult.workItemId;

      // Delete the work item
      const deleteResult = await service.deleteWorkItem(workItemId);

      assert.strictEqual(deleteResult.success, true);
      assert(deleteResult.message.includes('Successfully deleted'));
      assert(deleteResult.message.includes('Test Work Item'));
    });

    it('should delete associated tasks when deleting work item', async () => {
      // Create a test work item (which automatically creates a task)
      const createResult = await service.createWorkItem({
        name: 'Test Work Item with Tasks',
        description: 'Test description',
        type: 'user_story',
        assigned_to: 'developer'
      });

      const workItemId = createResult.workItemId;

      // Verify task was created
      const tasksBeforeDelete = db.prepare('SELECT * FROM tasks WHERE user_story_id = ?').all(workItemId);
      assert(tasksBeforeDelete.length > 0, 'Task should exist before deletion');

      // Delete the work item
      const deleteResult = await service.deleteWorkItem(workItemId);

      assert.strictEqual(deleteResult.success, true);
      assert.strictEqual(deleteResult.deletedTasks, tasksBeforeDelete.length);

      // Verify tasks were deleted
      const tasksAfterDelete = db.prepare('SELECT * FROM tasks WHERE user_story_id = ?').all(workItemId);
      assert.strictEqual(tasksAfterDelete.length, 0, 'Tasks should be deleted');
    });

    it('should return error for non-existent work item', async () => {
      const deleteResult = await service.deleteWorkItem(999);

      assert.strictEqual(deleteResult.success, false);
      assert(deleteResult.message.includes('not found'));
    });

    it('should handle child work items by setting parent_id to null', async () => {
      // Create parent work item
      const parentResult = await service.createWorkItem({
        name: 'Parent Work Item',
        description: 'Parent description',
        type: 'epic',
        assigned_to: 'architect'
      });

      // Create child work item by directly inserting into database
      const insertChild = db.prepare(`
        INSERT INTO work_items (name, description, type, assigned_to, parent_id, status, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'new', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      const childResult = insertChild.run(
        'Child Work Item', 
        'Child description', 
        'user_story', 
        'developer',
        parentResult.workItemId
      );
      
      const childId = childResult.lastInsertRowid as number;

      // Verify child has parent_id set
      const childBefore = db.prepare('SELECT * FROM work_items WHERE id = ?').get(childId) as any;
      assert.strictEqual(childBefore.parent_id, parentResult.workItemId);

      // Delete parent work item
      const deleteResult = await service.deleteWorkItem(parentResult.workItemId);
      assert.strictEqual(deleteResult.success, true);

      // Verify child exists but parent_id is null
      const childAfter = db.prepare('SELECT * FROM work_items WHERE id = ?').get(childId) as any;
      assert(childAfter, 'Child work item should still exist');
      assert.strictEqual(childAfter.parent_id, null, 'Child parent_id should be null');
    });

    it('should delete state transitions associated with work item', async () => {
      // Create a test work item
      const createResult = await service.createWorkItem({
        name: 'Test Work Item',
        description: 'Test description',
        type: 'bug',
        assigned_to: 'developer'
      });

      const workItemId = createResult.workItemId;

      // Add a state transition manually
      const insertTransition = db.prepare(`
        INSERT INTO state_transitions (work_item_id, from_state, to_state, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      insertTransition.run(workItemId, 'new', 'in_progress');

      // Verify transition exists
      const transitionsBefore = db.prepare('SELECT * FROM state_transitions WHERE work_item_id = ?').all(workItemId);
      assert(transitionsBefore.length > 0);

      // Delete the work item
      const deleteResult = await service.deleteWorkItem(workItemId);
      assert.strictEqual(deleteResult.success, true);

      // Verify transitions were deleted
      const transitionsAfter = db.prepare('SELECT * FROM state_transitions WHERE work_item_id = ?').all(workItemId);
      assert.strictEqual(transitionsAfter.length, 0, 'State transitions should be deleted');
    });
  });
});