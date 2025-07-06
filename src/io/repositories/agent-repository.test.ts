import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isValidAgentType, createAgentOperations, clearAllAgents, createAgent } from './agent-repository.ts';

// Mock database for testing curried functions
const createMockDb = () => {
  const changes = { changes: 42, lastInsertRowid: 123 };
  return {
    prepare: (sql: string) => ({
      run: (...args: any[]) => changes,
      get: (...args: any[]) => null
    })
  } as any;
};

describe('Agent Repository Functional Patterns', () => {
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

  describe('Curried Database Operations', () => {
    test('clearAllAgents should return a function when partially applied', () => {
      const mockDb = createMockDb();
      const clearOperation = clearAllAgents(mockDb);
      
      assert.strictEqual(typeof clearOperation, 'function');
      
      const result = clearOperation();
      assert.strictEqual(result, 42); // from mock changes
    });

    test('createAgent should return a function when partially applied', () => {
      const mockDb = createMockDb();
      const createOperation = createAgent(mockDb);
      
      assert.strictEqual(typeof createOperation, 'function');
      
      const result = createOperation('developer');
      assert.strictEqual(result, 123); // from mock lastInsertRowid
    });

    test('createAgent should validate agent types when called', () => {
      const mockDb = createMockDb();
      const createOperation = createAgent(mockDb);
      
      // Valid type should work
      assert.doesNotThrow(() => createOperation('developer'));
      
      // Invalid type should throw
      assert.throws(() => createOperation('invalid' as any), /Invalid agent type/);
    });
  });

  describe('Agent Operations Composition', () => {
    test('should create composed operations object', () => {
      const mockDb = createMockDb();
      const ops = createAgentOperations(mockDb);
      
      assert.strictEqual(typeof ops.clearAll, 'function');
      assert.strictEqual(typeof ops.create, 'function');
      assert.strictEqual(typeof ops.clearWorkItems, 'function');
      
      // Test that operations work
      const clearResult = ops.clearAll();
      const createResult = ops.create('architect');
      const clearWorkResult = ops.clearWorkItems();
      
      assert.strictEqual(clearResult, 42);
      assert.strictEqual(createResult, 123);
      assert.strictEqual(clearWorkResult, 42);
    });
  });
});