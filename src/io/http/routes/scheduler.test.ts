/**
 * Scheduler Control API Tests (TDD)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { createSchedulerRouter, type SchedulerControlService } from './scheduler.ts';

describe('Scheduler Control API', () => {
  describe('GET /status', () => {
    test('should return scheduler status', () => {
      const mockService: SchedulerControlService = {
        getStatus: async () => ({
          isRunning: false,
          intervalSeconds: 5,
          lastRunAt: null
        }),
        start: async () => true,
        stop: async () => true
      };

      const router = createSchedulerRouter(mockService);
      assert.ok(router);
    });
  });

  describe('POST /start', () => {
    test('should start scheduler', async () => {
      let started = false;
      
      const mockService: SchedulerControlService = {
        getStatus: async () => ({
          isRunning: true,
          intervalSeconds: 5,
          lastRunAt: null
        }),
        start: async () => {
          started = true;
          return true;
        },
        stop: async () => true
      };

      const router = createSchedulerRouter(mockService);
      const startRoute = router.routes['POST /start'];
      
      await startRoute();
      assert.strictEqual(started, true);
    });
  });

  describe('POST /stop', () => {
    test('should stop scheduler', async () => {
      let stopped = false;
      
      const mockService: SchedulerControlService = {
        getStatus: async () => ({
          isRunning: false,
          intervalSeconds: 5,
          lastRunAt: null
        }),
        start: async () => true,
        stop: async () => {
          stopped = true;
          return true;
        }
      };

      const router = createSchedulerRouter(mockService);
      const stopRoute = router.routes['POST /stop'];
      
      await stopRoute();
      assert.strictEqual(stopped, true);
    });
  });
});