/**
 * Tests for Hybrid Claude Executor
 */

import { HybridClaudeExecutor } from './hybrid-executor';
import { HeadlessClaudeExecutor } from './headless-claude';
import { InteractiveClaudeExecutor } from './interactive-claude';
import type { ExecutionRequest } from '../types';

// Mock the individual executors
jest.mock('./headless-claude');
jest.mock('./interactive-claude');

describe('HybridClaudeExecutor', () => {
  let executor: HybridClaudeExecutor;
  let mockHeadlessExecute: jest.Mock;
  let mockInteractiveExecute: jest.Mock;
  
  const mockTask = {
    id: 1,
    featureId: 'test-feature',
    role: 'developer' as const,
    description: 'Test task',
    status: 'in_progress' as const,
    attempts: 0,
    createdAt: new Date(),
  };

  const mockContext = [
    {
      id: 1,
      featureId: 'test-feature',
      type: 'architecture' as const,
      content: 'Test context',
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    mockHeadlessExecute = jest.fn().mockResolvedValue({
      success: true,
      output: { result: 'headless' },
      duration: 100,
    });
    
    mockInteractiveExecute = jest.fn().mockResolvedValue({
      success: true,
      output: { result: 'interactive' },
      duration: 200,
    });
    
    (HeadlessClaudeExecutor as jest.MockedClass<typeof HeadlessClaudeExecutor>).mockImplementation(() => ({
      execute: mockHeadlessExecute,
      checkClaudeAvailable: jest.fn().mockResolvedValue(true),
      getConfig: jest.fn().mockReturnValue({}),
      on: jest.fn(),
      emit: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
    } as any));
    
    (InteractiveClaudeExecutor as jest.MockedClass<typeof InteractiveClaudeExecutor>).mockImplementation(() => ({
      execute: mockInteractiveExecute,
      checkClaudeAvailable: jest.fn().mockResolvedValue(true),
      setManager: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
    } as any));
    
    executor = new HybridClaudeExecutor();
  });

  describe('execute', () => {
    it('should route developer tasks to interactive executor', async () => {
      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const result = await executor.execute(request);

      expect(mockInteractiveExecute).toHaveBeenCalledWith(request);
      expect(mockHeadlessExecute).not.toHaveBeenCalled();
      expect(result.output).toEqual({ result: 'interactive' });
    });

    it('should route architect tasks to headless executor', async () => {
      const request: ExecutionRequest = {
        task: { ...mockTask, role: 'architect' },
        role: 'architect',
        context: mockContext,
      };

      const result = await executor.execute(request);

      expect(mockHeadlessExecute).toHaveBeenCalledWith(request);
      expect(mockInteractiveExecute).not.toHaveBeenCalled();
      expect(result.output).toEqual({ result: 'headless' });
    });

    it('should route reviewer tasks to headless executor', async () => {
      const request: ExecutionRequest = {
        task: { ...mockTask, role: 'reviewer' },
        role: 'reviewer',
        context: mockContext,
      };

      const result = await executor.execute(request);

      expect(mockHeadlessExecute).toHaveBeenCalledWith(request);
      expect(mockInteractiveExecute).not.toHaveBeenCalled();
      expect(result.output).toEqual({ result: 'headless' });
    });

    it('should emit execution events', async () => {
      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const events: any[] = [];
      executor.on('execution:start', (data) => events.push({ type: 'start', ...data }));
      executor.on('execution:complete', (data) => events.push({ type: 'complete', ...data }));

      await executor.execute(request);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: 'start',
        taskId: 1,
        role: 'developer',
        mode: 'interactive',
      });
      expect(events[1]).toMatchObject({
        type: 'complete',
        taskId: 1,
        role: 'developer',
        mode: 'interactive',
        success: true,
      });
    });

    it('should handle execution errors', async () => {
      const error = new Error('Execution failed');
      mockInteractiveExecute.mockRejectedValue(error);

      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const errorEvents: any[] = [];
      executor.on('execution:error', (data) => errorEvents.push(data));

      await expect(executor.execute(request)).rejects.toThrow('Execution failed');
      
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        taskId: 1,
        role: 'developer',
        error: 'Execution failed',
      });
    });
  });

  describe('checkAvailability', () => {
    it('should check availability of both executors', async () => {
      const availability = await executor.checkAvailability();

      expect(availability).toEqual({
        headless: true,
        interactive: true,
      });
    });
  });
});