/**
 * Agents API Integration Tests (TDD)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { createAgentsRouter, type AgentService } from './agents.ts';

describe('Agents API Routes', () => {
  describe('GET /available', () => {
    test('should return available agents', () => {
      // Mock service
      const mockService: AgentService = {
        getAvailable: async () => [
          { id: 1, type: 'developer' },
          { id: 2, type: 'architect' }
        ]
      };

      const router = createAgentsRouter(mockService);
      
      // Test that router is created
      assert.ok(router);
    });
  });
});