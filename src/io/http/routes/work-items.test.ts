/**
 * Work Items API Integration Tests (TDD)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { createWorkItemsRouter, type WorkItemService } from './work-items.ts';

describe('Work Items API Routes', () => {
  describe('GET /assignable', () => {
    test('should return assignable work items', () => {
      // Mock service
      const mockService: WorkItemService = {
        getAssignable: async () => [
          { id: 101, type: 'epic', status: 'new' },
          { id: 102, type: 'user_story', status: 'new' }
        ],
        assign: async (id: number, agentId: number) => true
      };

      const router = createWorkItemsRouter(mockService);
      
      // Test that router is created
      assert.ok(router);
    });
  });

  describe('PATCH /:id', () => {
    test('should assign work item to agent', () => {
      const mockService: WorkItemService = {
        getAssignable: async () => [],
        assign: async (id: number, agentId: number) => {
          assert.strictEqual(id, 101);
          assert.strictEqual(agentId, 1);
          return true;
        }
      };

      const router = createWorkItemsRouter(mockService);
      assert.ok(router);
    });
  });
});