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
      ],
      configRepository: {
        get: () => ({ isRunning: false, intervalSeconds: 5 }),
        setRunning: (isRunning: boolean) => {},
        updateLastRun: () => {}
      }
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
      ],
      configRepository: {
        get: () => ({ isRunning: false, intervalSeconds: 5 }),
        setRunning: (isRunning: boolean) => {},
        updateLastRun: () => {}
      }
    };

    const scheduler = createScheduler(mockDependencies);
    await scheduler.runAssignmentCycle();
    
    assert.strictEqual(assignmentMade, true);
  });

  test('should update database when started', () => {
    let dbUpdated = false;
    
    const mockDependencies: SchedulerDependencies = {
      agentService: {
        getAvailable: async () => []
      },
      workItemService: {
        getAssignable: async () => [],
        assign: async () => true
      },
      assignmentRules: [],
      configRepository: {
        get: () => ({ isRunning: false, intervalSeconds: 5 }),
        setRunning: (isRunning: boolean) => {
          if (isRunning === true) dbUpdated = true;
        },
        updateLastRun: () => {}
      }
    };

    const scheduler = createScheduler(mockDependencies);
    scheduler.start();
    scheduler.stop(); // Clean up interval
    
    assert.strictEqual(dbUpdated, true);
  });

  test('should update database when stopped', () => {
    let dbUpdated = false;
    
    const mockDependencies: SchedulerDependencies = {
      agentService: {
        getAvailable: async () => []
      },
      workItemService: {
        getAssignable: async () => [],
        assign: async () => true
      },
      assignmentRules: [],
      configRepository: {
        get: () => ({ isRunning: true, intervalSeconds: 5 }),
        setRunning: (isRunning: boolean) => {
          if (isRunning === false) dbUpdated = true;
        },
        updateLastRun: () => {}
      }
    };

    const scheduler = createScheduler(mockDependencies);
    scheduler.start();
    scheduler.stop();
    
    assert.strictEqual(dbUpdated, true);
  });
});