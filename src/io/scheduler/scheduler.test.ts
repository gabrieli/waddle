/**
 * Scheduler Integration Tests (TDD)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { createScheduler, type SchedulerDependencies } from './scheduler.ts';

describe('Scheduler Integration', () => {
  test('should create scheduler with dependencies', () => {
    const mockDependencies: SchedulerDependencies = {
      agentService: {
        getAvailable: async () => [{ id: 1, type: 'developer' }]
      },
      workItemService: {
        getAssignable: async () => [{ id: 101, type: 'user_story', status: 'new' }],
        assign: async (workItemId: number, agentId: number) => true
      },
      assignmentRules: [
        { agentType: 'developer', workType: 'user_story', workStatus: 'new' }
      ]
    };

    const scheduler = createScheduler(mockDependencies);
    assert.ok(scheduler);
  });

  test('should perform assignment cycle', async () => {
    let assignmentMade = false;
    
    const mockDependencies: SchedulerDependencies = {
      agentService: {
        getAvailable: async () => [{ id: 1, type: 'developer' }]
      },
      workItemService: {
        getAssignable: async () => [{ id: 101, type: 'user_story', status: 'new' }],
        assign: async (workItemId: number, agentId: number) => {
          assignmentMade = true;
          return true;
        }
      },
      assignmentRules: [
        { agentType: 'developer', workType: 'user_story', workStatus: 'new' }
      ]
    };

    const scheduler = createScheduler(mockDependencies);
    await scheduler.runAssignmentCycle();
    
    assert.strictEqual(assignmentMade, true);
  });
});