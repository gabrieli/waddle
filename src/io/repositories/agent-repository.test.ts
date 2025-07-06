import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isValidAgentType } from './agent-repository.ts';

describe('Agent Repository Pure Functions', () => {
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
});