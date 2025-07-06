import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { createHttpClient } from './agent-client.ts';
import * as AgentInit from '../../core/workflows/agent-initialization.ts';

describe('Agent HTTP Client Integration', () => {
  let serverProcess;
  const baseUrl = 'http://localhost:3001';
  const httpClient = createHttpClient({ baseUrl, timeout: 5000 });

  before(async () => {
    // Start the server for testing
    serverProcess = spawn('node', ['src/io/http/index.js'], {
      env: { ...process.env, PORT: '3001', NODE_ENV: 'test' },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  after(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  });

  test('should successfully initialize agents via HTTP API', async () => {
    const config = {
      httpClient,
      agentTypes: ['developer', 'architect', 'tester']
    };

    const result = await AgentInit.initializeAgents(config);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.agentsCreated, 3);
    assert.strictEqual(result.workItemsReset, true);
    assert.strictEqual(result.systemReady, true);
  });

  test('should handle DELETE /api/agents', async () => {
    const result = await httpClient.delete('/api/agents');
    assert.strictEqual(result.success, true);
  });

  test('should handle POST /api/agents', async () => {
    const result = await httpClient.post('/api/agents', { type: 'developer' });
    assert.strictEqual(result.success, true);
    assert.ok(result.id);
  });

  test('should handle PATCH /api/work-items/assignments', async () => {
    const result = await httpClient.patch('/api/work-items/assignments', {
      agent_id: null,
      started_at: null
    });
    assert.strictEqual(result.success, true);
  });

  test('should handle invalid agent type', async () => {
    try {
      await httpClient.post('/api/agents', { type: 'invalid' });
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error.message.includes('400') || error.message.includes('Invalid'));
    }
  });
});