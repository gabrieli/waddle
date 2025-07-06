import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as AgentInit from './agent-initialization.ts';

describe('Agent Initialization', () => {
  test('should clear all existing agents on initialization', async () => {
    // Arrange
    const mockAgentRepository = {
      clearAll: async () => {
        return 5; // Simulate 5 agents deleted
      },
      create: async () => 1,
      clearWorkItemAssignments: async () => 0
    };

    const config: AgentInit.AgentInitializationConfig = {
      agentRepository: mockAgentRepository,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, true);
  });

  test('should create 3 agents (developer, architect, tester)', async () => {
    // Arrange
    const createdAgents: Array<AgentInit.AgentType> = [];
    const mockAgentRepository = {
      clearAll: async () => 0,
      create: async (type: AgentInit.AgentType) => {
        createdAgents.push(type);
        return createdAgents.length;
      },
      clearWorkItemAssignments: async () => 0
    };

    const config: AgentInit.AgentInitializationConfig = {
      agentRepository: mockAgentRepository,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(createdAgents.length, 3);
    assert.ok(createdAgents.includes('developer'));
    assert.ok(createdAgents.includes('architect'));
    assert.ok(createdAgents.includes('tester'));
  });

  test('should clear work item assignments to reset interrupted work', async () => {
    // Arrange
    let workItemsCleared = false;
    const mockAgentRepository = {
      clearAll: async () => 0,
      create: async () => 1,
      clearWorkItemAssignments: async () => {
        workItemsCleared = true;
        return 3; // Simulate 3 work items updated
      }
    };

    const config: AgentInit.AgentInitializationConfig = {
      agentRepository: mockAgentRepository,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(workItemsCleared, true);
  });

  test('should handle repository failures gracefully', async () => {
    // Arrange
    const mockAgentRepository = {
      clearAll: async () => {
        throw new Error('Database connection failed');
      },
      create: async () => 1,
      clearWorkItemAssignments: async () => 0
    };

    const config: AgentInit.AgentInitializationConfig = {
      agentRepository: mockAgentRepository,
      agentTypes: ['developer', 'architect', 'tester']
    };

    // Act
    const result = await AgentInit.initializeAgents(config);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Database connection failed'));
  });

  test('should leave system in ready state for scheduler operation', async () => {
    // Arrange
    const mockAgentRepository = {
      clearAll: async () => 0,
      create: async () => 1,
      clearWorkItemAssignments: async () => 0
    };

    const config: AgentInit.AgentInitializationConfig = {
      agentRepository: mockAgentRepository,
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
    let createCallCount = 0;
    const mockAgentRepository = {
      clearAll: async () => 0,
      create: async () => {
        createCallCount++;
        if (createCallCount === 2) {
          throw new Error('Failed to create architect agent');
        }
        return createCallCount;
      },
      clearWorkItemAssignments: async () => 0
    };

    const config: AgentInit.AgentInitializationConfig = {
      agentRepository: mockAgentRepository,
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