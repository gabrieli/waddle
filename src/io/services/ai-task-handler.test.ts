/**
 * AI Task Handler Tests
 * 
 * Unit tests for the AI task processing functionality.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAITaskHandler } from './ai-task-handler.ts';

describe('AI Task Handler', () => {
  const aiHandler = createAITaskHandler();

  describe('Mathematical Operations', () => {
    it('should handle addition correctly', async () => {
      const result = await aiHandler.processTask('2+2');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '2 + 2 = 4');
    });

    it('should handle addition with spaces', async () => {
      const result = await aiHandler.processTask('5 + 3');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '5 + 3 = 8');
    });

    it('should handle subtraction correctly', async () => {
      const result = await aiHandler.processTask('10-4');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '10 - 4 = 6');
    });

    it('should handle subtraction with spaces', async () => {
      const result = await aiHandler.processTask('15 - 7');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '15 - 7 = 8');
    });

    it('should handle multiplication correctly', async () => {
      const result = await aiHandler.processTask('6*7');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '6 * 7 = 42');
    });

    it('should handle multiplication with spaces', async () => {
      const result = await aiHandler.processTask('9 * 3');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '9 * 3 = 27');
    });

    it('should handle large numbers', async () => {
      const result = await aiHandler.processTask('123 + 456');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '123 + 456 = 579');
    });

    it('should handle zero operations', async () => {
      const result = await aiHandler.processTask('0 + 0');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '0 + 0 = 0');
    });
  });

  describe('Text-based Tasks', () => {
    it('should handle hello greeting', async () => {
      const result = await aiHandler.processTask('hello');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Hello! Task processed successfully.');
    });

    it('should handle hello with additional text', async () => {
      const result = await aiHandler.processTask('hello world');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Hello! Task processed successfully.');
    });

    it('should handle Hello with different case', async () => {
      const result = await aiHandler.processTask('Hello there');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Hello! Task processed successfully.');
    });

    it('should handle HELLO in uppercase', async () => {
      const result = await aiHandler.processTask('HELLO');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Hello! Task processed successfully.');
    });
  });

  describe('Generic Tasks', () => {
    it('should handle generic task description', async () => {
      const taskDesc = 'Create a new feature';
      const result = await aiHandler.processTask(taskDesc);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, `Processed task: ${taskDesc}`);
    });

    it('should handle empty task description', async () => {
      const result = await aiHandler.processTask('');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Processed task: ');
    });

    it('should handle complex task description', async () => {
      const taskDesc = 'Implement user authentication with JWT tokens and password hashing';
      const result = await aiHandler.processTask(taskDesc);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, `Processed task: ${taskDesc}`);
    });

    it('should handle task with special characters', async () => {
      const taskDesc = 'Handle @mentions and #hashtags in comments';
      const result = await aiHandler.processTask(taskDesc);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, `Processed task: ${taskDesc}`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks with mixed content', async () => {
      // Should prioritize math over text
      const result = await aiHandler.processTask('Calculate 5+3 for the hello system');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '5 + 3 = 8');
    });

    it('should handle multiple math operations (first one wins)', async () => {
      const result = await aiHandler.processTask('First 2+2 then 3+3');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '2 + 2 = 4');
    });

    it('should handle tasks with numbers but no operators', async () => {
      const result = await aiHandler.processTask('Process 123 items');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Processed task: Process 123 items');
    });

    it('should handle tasks with operators but no valid numbers', async () => {
      const result = await aiHandler.processTask('Add + more features');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Processed task: Add + more features');
    });
  });

  describe('Error Handling', () => {
    it('should handle null task description gracefully', async () => {
      const result = await aiHandler.processTask(null as any);
      assert.strictEqual(result.success, false);
      assert(result.error, 'Should have an error message');
    });

    it('should handle undefined task description gracefully', async () => {
      const result = await aiHandler.processTask(undefined as any);
      assert.strictEqual(result.success, false);
      assert(result.error, 'Should have an error message');
    });
  });
});