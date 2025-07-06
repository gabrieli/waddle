import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as AgentInit from './agent-initialization.ts';

describe('Agent Initialization', () => {
  test('should call DELETE /api/agents on initialization', async () => {
    // Arrange
    const mockHttpClient = {
      delete: async (url: string) => {
        assert.strictEqual(url, '/api/agents');
        return { success: true };
      },
      post: async () => ({ success: true }),
      patch: async () => ({ success: true })
    };

    const config: AgentInit.AgentInitializationConfig = {
      httpClient: mockHttpClient,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, true);
  });

  test('should call POST /api/agents to create 3 agents (developer, architect, tester)', async () => {
    // Arrange
    const createdAgents: Array<{ type: AgentInit.AgentType }> = [];
    const mockHttpClient = {
      delete: async () => ({ success: true }),
      post: async (url: string, data: any) => {
        assert.strictEqual(url, '/api/agents');
        assert.ok(data.type);
        createdAgents.push(data);
        return { success: true, id: createdAgents.length };
      },
      patch: async () => ({ success: true })
    };

    const config: AgentInit.AgentInitializationConfig = {
      httpClient: mockHttpClient,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(createdAgents.length, 3);
    assert.ok(createdAgents.find(a => a.type === 'developer'));
    assert.ok(createdAgents.find(a => a.type === 'architect'));
    assert.ok(createdAgents.find(a => a.type === 'tester'));
  });

  test('should call PATCH /api/work-items/assignments to reset interrupted work', async () => {
    // Arrange
    const mockHttpClient = {
      delete: async () => ({ success: true }),
      post: async () => ({ success: true }),
      patch: async (url: string, data: any) => {
        assert.strictEqual(url, '/api/work-items/assignments');
        assert.deepStrictEqual(data, { agent_id: null, started_at: null });
        return { success: true };
      }
    };

    const config: AgentInit.AgentInitializationConfig = {
      httpClient: mockHttpClient,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, true);
  });

  test('should handle API call failures gracefully', async () => {
    // Arrange
    const mockHttpClient = {
      delete: async () => {
        throw new Error('Network error');
      },
      post: async () => ({ success: true }),
      patch: async () => ({ success: true })
    };

    const config: AgentInit.AgentInitializationConfig = {
      httpClient: mockHttpClient,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Network error'));
  });

  test('should leave system in ready state for scheduler operation', async () => {
    // Arrange
    const mockHttpClient = {
      delete: async () => ({ success: true }),
      post: async () => ({ success: true }),
      patch: async () => ({ success: true })
    };

    const config: AgentInit.AgentInitializationConfig = {
      httpClient: mockHttpClient,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.agentsCreated, 3);
    assert.strictEqual(result.workItemsReset, true);
    assert.strictEqual(result.systemReady, true);
  });

  test('should handle partial failures and report them', async () => {
    // Arrange
    let postCallCount = 0;
    const mockHttpClient = {
      delete: async () => ({ success: true }),
      post: async () => {
        postCallCount++;
        if (postCallCount === 2) {
          throw new Error('Failed to create architect agent');
        }
        return { success: true };
      },
      patch: async () => ({ success: true })
    };

    const config: AgentInit.AgentInitializationConfig = {
      httpClient: mockHttpClient,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Failed to create architect agent'));
  });
});