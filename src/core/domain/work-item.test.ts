import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  isValidWorkItemStatus, 
  isValidWorkItemType, 
  isValidAgentType, 
  isValidBranchName,
  generateBranchName,
  createWorkItem,
  createAgent 
} from './work-item.ts';

describe('Work Item Domain Functions', () => {
  describe('Validation Functions', () => {
    test('isValidWorkItemStatus should validate status values', () => {
      // Valid statuses
      assert.strictEqual(isValidWorkItemStatus('new'), true);
      assert.strictEqual(isValidWorkItemStatus('in_progress'), true);
      assert.strictEqual(isValidWorkItemStatus('review'), true);
      assert.strictEqual(isValidWorkItemStatus('done'), true);
      
      // Invalid statuses
      assert.strictEqual(isValidWorkItemStatus('invalid'), false);
      assert.strictEqual(isValidWorkItemStatus('pending'), false);
      assert.strictEqual(isValidWorkItemStatus(''), false);
    });

    test('isValidWorkItemType should validate type values', () => {
      // Valid types
      assert.strictEqual(isValidWorkItemType('epic'), true);
      assert.strictEqual(isValidWorkItemType('user_story'), true);
      assert.strictEqual(isValidWorkItemType('bug'), true);
      
      // Invalid types
      assert.strictEqual(isValidWorkItemType('task'), false);
      assert.strictEqual(isValidWorkItemType('feature'), false);
      assert.strictEqual(isValidWorkItemType(''), false);
    });

    test('isValidAgentType should validate agent type values', () => {
      // Valid agent types
      assert.strictEqual(isValidAgentType('developer'), true);
      assert.strictEqual(isValidAgentType('architect'), true);
      assert.strictEqual(isValidAgentType('tester'), true);
      
      // Invalid agent types
      assert.strictEqual(isValidAgentType('manager'), false);
      assert.strictEqual(isValidAgentType('designer'), false);
      assert.strictEqual(isValidAgentType(''), false);
    });

    test('isValidBranchName should validate branch naming format', () => {
      // Valid branch names
      assert.strictEqual(isValidBranchName('feature/work-item-123-test-feature'), true);
      assert.strictEqual(isValidBranchName('feature/work-item-1-simple'), true);
      assert.strictEqual(isValidBranchName('feature/work-item-999-multi-word-feature'), true);
      
      // Invalid branch names
      assert.strictEqual(isValidBranchName('feature/work-123-missing-item'), false);
      assert.strictEqual(isValidBranchName('bug/work-item-123-wrong-prefix'), false);
      assert.strictEqual(isValidBranchName('feature/work-item-abc-non-numeric'), false);
      assert.strictEqual(isValidBranchName('feature/work-item-123'), false); // Missing slug
      assert.strictEqual(isValidBranchName(''), false);
    });
  });

  describe('Branch Name Generation', () => {
    test('generateBranchName should create properly formatted branch names', () => {
      assert.strictEqual(
        generateBranchName(123, 'Test Feature'), 
        'feature/work-item-123-test-feature'
      );
      
      assert.strictEqual(
        generateBranchName(1, 'Simple Task'), 
        'feature/work-item-1-simple-task'
      );
      
      assert.strictEqual(
        generateBranchName(999, 'Complex Multi-Word Feature'), 
        'feature/work-item-999-complex-multi-word-feature'
      );
    });

    test('generateBranchName should sanitize slug characters', () => {
      assert.strictEqual(
        generateBranchName(123, 'Feature with Special!@#$%^&*()Characters'), 
        'feature/work-item-123-feature-with-special----------characters'
      );
      
      assert.strictEqual(
        generateBranchName(456, 'UPPERCASE Feature'), 
        'feature/work-item-456-uppercase-feature'
      );
    });
  });

  describe('Factory Functions', () => {
    test('createWorkItem should create work item with correct defaults', () => {
      const workItem = createWorkItem('Test Epic', 'epic', 'Test description');
      
      assert.strictEqual(workItem.name, 'Test Epic');
      assert.strictEqual(workItem.status, 'new');
      assert.strictEqual(workItem.description, 'Test description');
      assert.strictEqual(workItem.type, 'epic');
      assert.strictEqual(workItem.version, 1);
      assert.strictEqual(workItem.parent_id, undefined);
    });

    test('createWorkItem should support parent ID for child items', () => {
      const workItem = createWorkItem('User Story', 'user_story', 'Story description', 123);
      
      assert.strictEqual(workItem.name, 'User Story');
      assert.strictEqual(workItem.type, 'user_story');
      assert.strictEqual(workItem.parent_id, 123);
    });

    test('createAgent should create agent with correct defaults', () => {
      const agent = createAgent('developer');
      
      assert.strictEqual(agent.type, 'developer');
      assert.strictEqual(agent.version, 1);
      assert.strictEqual(agent.work_item_id, undefined);
    });
  });
});