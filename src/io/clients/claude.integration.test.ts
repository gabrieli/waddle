import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { executeClaude } from './claude.ts';

describe('Claude functional client', () => {
  test('executeClaude returns a promise', () => {
    const result = executeClaude('test prompt');
    assert(result instanceof Promise);
    // Clean up the promise to avoid unhandled rejection
    result.catch(() => {});
  });

  test('executeClaude with verbose flag returns a promise', () => {
    const result = executeClaude('test prompt', { verbose: true });
    assert(result instanceof Promise);
    // Clean up the promise to avoid unhandled rejection
    result.catch(() => {});
  });

  // Example usage tests (commented out as they require Claude to be installed)
  test('should return output string by default (verbose=false)', async () => {
    const output = await executeClaude('echo "4"', { timeout: 30000 });
    
    assert(typeof output === 'string');
    assert(output.length > 0);
    console.log('Claude response:', output);
  });

  test('should return full response object with verbose=true', async () => {
    const result = await executeClaude('echo "Hello"', { verbose: true, timeout: 30000 });
    
    console.log('Result type:', typeof result);
    console.log('Result:', result);
    
    assert(typeof result === 'object');
    assert('success' in result);
    assert('output' in result);
    assert(result.success);
    console.log('Claude output:', result.output);
  });

  test('should throw error by default when command fails', async () => {
    // Temporarily change HOME to simulate Claude not being found
    const originalHome = process.env.HOME;
    process.env.HOME = '/nonexistent';
    
    try {
      await assert.rejects(
        executeClaude('echo "test"'),
        /Failed to start Claude|No such file|command not found/
      );
    } finally {
      process.env.HOME = originalHome;
    }
  });

  test('should return error object with verbose=true when command fails', async () => {
    // Temporarily change HOME to simulate Claude not being found
    const originalHome = process.env.HOME;
    process.env.HOME = '/nonexistent';
    
    try {
      const result = await executeClaude('echo "test"', { verbose: true });
      assert(typeof result === 'object');
      assert(!result.success);
      assert(result.error);
      assert(result.error.match(/Failed to start Claude|No such file|command not found/));
    } finally {
      process.env.HOME = originalHome;
    }
  });

  test('should support custom working directory', async () => {
    const result = await executeClaude('echo "test"', { cwd: '/tmp', verbose: true, timeout: 30000 });
    assert(result instanceof Object);
    assert(result.success);
    assert(result.output);
  });
});