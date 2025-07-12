/**
 * Work Item Service Tests
 * 
 * Tests for work item creation functionality
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { createWorkItemService } from './work-item-service.ts';
import { runMigrations } from '../db/migrations.ts';

describe('Work Item Service', () => {
  let db: Database.Database;
  let workItemService: ReturnType<typeof createWorkItemService>;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations to set up schema
    runMigrations(db);
    
    // Create service
    workItemService = createWorkItemService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Work item creation', () => {
    it('should create a user story work item', async () => {
      const result = await workItemService.createWorkItem({
        name: 'Test User Story',
        description: 'This is a test user story',
        type: 'user_story',
        assigned_to: 'developer'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.name, 'Test User Story');
      assert.strictEqual(result.type, 'user_story');
      assert.strictEqual(result.assigned_to, 'developer');
      assert(result.workItemId);

      // Verify in database
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(result.workItemId);
      assert.strictEqual(workItem.name, 'Test User Story');
      assert.strictEqual(workItem.description, 'This is a test user story');
      assert.strictEqual(workItem.type, 'user_story');
      assert.strictEqual(workItem.assigned_to, 'developer');
      assert.strictEqual(workItem.status, 'new');
      assert.strictEqual(workItem.version, 1);
    });

    it('should create an epic work item', async () => {
      const result = await workItemService.createWorkItem({
        name: 'Test Epic',
        description: 'This is a test epic',
        type: 'epic',
        assigned_to: 'architect'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'epic');
      assert.strictEqual(result.assigned_to, 'architect');

      // Verify in database
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(result.workItemId);
      assert.strictEqual(workItem.type, 'epic');
      assert.strictEqual(workItem.assigned_to, 'architect');
    });

    it('should create a bug work item', async () => {
      const result = await workItemService.createWorkItem({
        name: 'Test Bug',
        description: 'This is a test bug',
        type: 'bug',
        assigned_to: 'tester'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'bug');
      assert.strictEqual(result.assigned_to, 'tester');

      // Verify in database
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(result.workItemId);
      assert.strictEqual(workItem.type, 'bug');
      assert.strictEqual(workItem.assigned_to, 'tester');
    });

    it('should handle all valid assignment combinations', async () => {
      const types = ['epic', 'user_story', 'bug'];
      const assignees = ['developer', 'architect', 'tester'];
      
      for (const type of types) {
        for (const assignee of assignees) {
          const result = await workItemService.createWorkItem({
            name: `Test ${type}`,
            description: `Test ${type} assigned to ${assignee}`,
            type: type as any,
            assigned_to: assignee as any
          });
          
          assert.strictEqual(result.success, true);
          assert.strictEqual(result.type, type);
          assert.strictEqual(result.assigned_to, assignee);
        }
      }
    });

    it('should set proper timestamps', async () => {
      const result = await workItemService.createWorkItem({
        name: 'Timestamp Test',
        description: 'Testing timestamps',
        type: 'user_story',
        assigned_to: 'developer'
      });

      // Verify timestamps exist in database
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(result.workItemId);
      
      assert(workItem.created_at);
      assert(workItem.updated_at);
      assert.strictEqual(typeof workItem.created_at, 'string');
      assert.strictEqual(typeof workItem.updated_at, 'string');
      
      // Should be able to parse as dates
      const createdAt = new Date(workItem.created_at);
      const updatedAt = new Date(workItem.updated_at);
      assert(!isNaN(createdAt.getTime()));
      assert(!isNaN(updatedAt.getTime()));
    });
  });
});