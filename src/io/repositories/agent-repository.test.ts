import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isValidAgentType, createAgentRepository } from './agent-repository.ts';

describe('Agent Repository', () => {
  describe('isValidAgentType', () => {
    test('should return true for valid agent types', () => {
      assert.strictEqual(isValidAgentType('developer'), true);
      assert.strictEqual(isValidAgentType('architect'), true);
      assert.strictEqual(isValidAgentType('tester'), true);
    });

    test('should return false for invalid agent types', () => {
      assert.strictEqual(isValidAgentType('invalid'), false);
      assert.strictEqual(isValidAgentType('manager'), false);
      assert.strictEqual(isValidAgentType(''), false);
      assert.strictEqual(isValidAgentType('DEVELOPER'), false); // case sensitive
    });

    test('should handle edge cases', () => {
      assert.strictEqual(isValidAgentType('developer '), false); // trailing space
      assert.strictEqual(isValidAgentType(' developer'), false); // leading space
      assert.strictEqual(isValidAgentType('Developer'), false); // wrong case
    });
  });

  describe('createAgentRepository', () => {
    test('should create repository with correct interface', () => {
      // Mock database for testing
      const mockDb = {
        prepare: () => ({
          run: () => ({ changes: 42, lastInsertRowid: 123 }),
          get: () => null
        })
      } as any;

      const repository = createAgentRepository(mockDb);
      
      // Check interface
      assert.strictEqual(typeof repository.clearAll, 'function');
      assert.strictEqual(typeof repository.create, 'function');
      assert.strictEqual(typeof repository.clearWorkItemAssignments, 'function');
    });

    test('should create repository with default database when none provided', () => {
      // This tests that createAgentRepository handles the default case
      // We can't easily test the actual database operations here without mocking getDatabase()
      assert.doesNotThrow(() => createAgentRepository());
    });
  });
});