/**
 * AI Task Handler Simple Tests
 * 
 * Basic tests for the AI task processing functionality using Node.js test runner.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAITaskHandler } from './ai-task-handler.ts';

describe('AI Task Handler', () => {
  const aiHandler = createAITaskHandler();

  describe('Mathematical Operations', () => {
    it('should handle 2+2 correctly', async () => {
      const result = await aiHandler.processTask('2+2');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '2 + 2 = 4');
    });

    it('should handle 5+3 with spaces', async () => {
      const result = await aiHandler.processTask('5 + 3');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '5 + 3 = 8');
    });

    it('should handle 10-4 subtraction', async () => {
      const result = await aiHandler.processTask('10-4');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '10 - 4 = 6');
    });

    it('should handle 6*7 multiplication', async () => {
      const result = await aiHandler.processTask('6*7');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '6 * 7 = 42');
    });
  });

  describe('Text-based Tasks', () => {
    it('should handle hello greeting', async () => {
      const result = await aiHandler.processTask('hello');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Hello! Task processed successfully.');
    });

    it('should handle hello world', async () => {
      const result = await aiHandler.processTask('hello world');
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

    it('should handle complex task description', async () => {
      const taskDesc = 'Implement user authentication';
      const result = await aiHandler.processTask(taskDesc);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, `Processed task: ${taskDesc}`);
    });
  });

  describe('Edge Cases', () => {
    it('should prioritize math over text', async () => {
      const result = await aiHandler.processTask('Calculate 5+3 for the hello system');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '5 + 3 = 8');
    });

    it('should handle multiple math operations (first one wins)', async () => {
      const result = await aiHandler.processTask('First 2+2 then 3+3');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, '2 + 2 = 4');
    });
  });
});