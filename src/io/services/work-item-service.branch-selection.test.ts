/**
 * Work Item Service Branch Selection Tests
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { createWorkItemService } from './work-item-service.ts';
import { runMigrations } from '../db/migrations.ts';

describe('Work Item Service - Branch Selection', () => {
  let db: Database.Database;
  let service: ReturnType<typeof createWorkItemService>;

  beforeEach(() => {
    // Create in-memory database for each test
    console.log('Initializing test database at :memory:');
    db = new Database(':memory:');
    runMigrations(db);
    console.log('Database initialized successfully for test environment');
    
    service = createWorkItemService(db);
  });

  describe('createWorkItem with branch selection', () => {
    test('should create work item with new branch when create_new_branch is true', async () => {
      const result = await service.createWorkItem({
        name: 'Test User Story',
        description: 'Test description',
        type: 'user_story',
        assigned_to: 'developer',
        create_new_branch: true
      });

      assert(result.success === true, 'Should create work item successfully');
      assert(typeof result.workItemId === 'number', 'Should return work item ID');
      assert(typeof result.branch_name === 'string', 'Should return branch name');
      assert(result.branch_name?.startsWith('feature/work-item-'), 'Should follow naming convention');

      // Verify work item was created in database
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(result.workItemId);
      assert(workItem !== undefined, 'Work item should be stored in database');
      assert(workItem.branch_name === result.branch_name, 'Branch name should match');
    });

    test('should create work item with existing branch when branch_name is provided', async () => {
      const existingBranch = 'feature/existing-branch';
      
      const result = await service.createWorkItem({
        name: 'Test Bug Fix',
        description: 'Test bug description',
        type: 'bug',
        assigned_to: 'developer',
        branch_name: existingBranch,
        create_new_branch: false
      });

      assert(result.success === true, 'Should create work item successfully');
      assert(result.branch_name === existingBranch, 'Should use provided branch name');

      // Verify work item was created in database
      const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(result.workItemId);
      assert(workItem.branch_name === existingBranch, 'Should store provided branch name');
    });

    test('should default to new branch when no branch parameters provided', async () => {
      const result = await service.createWorkItem({
        name: 'Default Branch Test',
        description: 'Test description',
        type: 'epic',
        assigned_to: 'architect'
      });

      assert(result.success === true, 'Should create work item successfully');
      assert(typeof result.branch_name === 'string', 'Should generate branch name');
      assert(result.branch_name?.startsWith('feature/work-item-'), 'Should follow naming convention');
      assert(result.branch_name?.includes('default-branch-test'), 'Should include sanitized name');
    });

    test('should sanitize branch name properly', async () => {
      const result = await service.createWorkItem({
        name: 'Fix Bug #123: Special Characters & Symbols!',
        description: 'Test description',
        type: 'bug',
        assigned_to: 'developer',
        create_new_branch: true
      });

      assert(result.success === true, 'Should create work item successfully');
      const branchName = result.branch_name!;
      
      // Should not contain special characters
      assert(!branchName.includes('#'), 'Should not contain hash');
      assert(!branchName.includes('&'), 'Should not contain ampersand');
      assert(!branchName.includes('!'), 'Should not contain exclamation');
      assert(!branchName.includes(':'), 'Should not contain colon');
      
      // Should contain sanitized version
      assert(branchName.includes('fix-bug'), 'Should contain sanitized words');
    });

    test('should create appropriate task based on assigned_to', async () => {
      const testCases = [
        { assigned_to: 'developer' as const, expectedTaskType: 'development' },
        { assigned_to: 'architect' as const, expectedTaskType: 'development' },
        { assigned_to: 'tester' as const, expectedTaskType: 'testing' },
        { assigned_to: 'reviewer' as const, expectedTaskType: 'review' }
      ];

      for (const { assigned_to, expectedTaskType } of testCases) {
        const result = await service.createWorkItem({
          name: `Test ${assigned_to} work item`,
          description: 'Test description',
          type: 'user_story',
          assigned_to,
          create_new_branch: true
        });

        assert(result.success === true, `Should create work item for ${assigned_to}`);

        // Check that task was created
        const task = db.prepare(`
          SELECT * FROM tasks 
          WHERE user_story_id = ? AND type = ?
        `).get(result.workItemId, expectedTaskType);

        assert(task !== undefined, `Should create ${expectedTaskType} task for ${assigned_to}`);
        assert(task.branch_name === result.branch_name, 'Task should have same branch name');
      }
    });

    test('should handle empty branch name gracefully', async () => {
      const result = await service.createWorkItem({
        name: 'Test Empty Branch',
        description: 'Test description',
        type: 'user_story',
        assigned_to: 'developer',
        branch_name: '',
        create_new_branch: false
      });

      assert(result.success === true, 'Should create work item successfully');
      // Should fall back to generating new branch name
      assert(typeof result.branch_name === 'string', 'Should generate branch name');
      assert(result.branch_name?.startsWith('feature/work-item-'), 'Should follow naming convention');
    });
  });

  describe('branch name generation edge cases', () => {
    test('should handle very long names', async () => {
      const longName = 'This is a very long work item name that exceeds normal length limits and should be handled gracefully';
      
      const result = await service.createWorkItem({
        name: longName,
        description: 'Test description',
        type: 'user_story',
        assigned_to: 'developer',
        create_new_branch: true
      });

      assert(result.success === true, 'Should create work item successfully');
      assert(typeof result.branch_name === 'string', 'Should generate branch name');
      
      // Branch name should be reasonable length
      const branchName = result.branch_name!;
      assert(branchName.length < 100, 'Branch name should not be excessively long');
    });

    test('should handle names with only special characters', async () => {
      const result = await service.createWorkItem({
        name: '!@#$%^&*()',
        description: 'Test description',
        type: 'bug',
        assigned_to: 'developer',
        create_new_branch: true
      });

      assert(result.success === true, 'Should create work item successfully');
      assert(typeof result.branch_name === 'string', 'Should generate branch name');
      
      // Should still create valid branch name
      const branchName = result.branch_name!;
      assert(branchName.startsWith('feature/work-item-'), 'Should follow naming convention');
    });
  });
});