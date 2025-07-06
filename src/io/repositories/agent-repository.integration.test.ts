import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createAgentRepository } from './agent-repository.ts';
import { resetDatabase } from '../db/index.ts';
import * as AgentInit from '../../core/workflows/agent-initialization.ts';

describe('Agent Repository Integration', () => {
  let agentRepository: AgentInit.AgentRepository;

  beforeEach(() => {
    resetDatabase(); // Clean slate for each test
    agentRepository = createAgentRepository();
  });

  test('should clear all agents from database', async () => {
    // Arrange - clear first, then create some agents
    await agentRepository.clearAll();
    await agentRepository.create('developer');
    await agentRepository.create('architect');

    // Act
    const deletedCount = await agentRepository.clearAll();

    // Assert
    assert.strictEqual(deletedCount, 2);
  });

  test('should create agents with correct types', async () => {
    // Act
    const developerId = await agentRepository.create('developer');
    const architectId = await agentRepository.create('architect');
    const testerId = await agentRepository.create('tester');

    // Assert
    assert.ok(developerId > 0);
    assert.ok(architectId > 0);
    assert.ok(testerId > 0);
    assert.notStrictEqual(developerId, architectId);
  });

  test('should reject invalid agent types', async () => {
    // Act & Assert
    await assert.rejects(
      async () => {
        // @ts-expect-error - testing invalid type
        await agentRepository.create('invalid');
      },
      /Invalid agent type: invalid/
    );
  });

  test('should complete full agent initialization workflow', async () => {
    // Arrange
    const config: AgentInit.AgentInitializationConfig = {
      agentRepository,
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

  test('should handle work item assignment clearing', async () => {
    // Act
    const updatedCount = await agentRepository.clearWorkItemAssignments();

    // Assert - should work even with no work items
    assert.strictEqual(updatedCount, 0);
  });
});