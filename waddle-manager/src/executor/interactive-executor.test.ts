/**
 * Tests for Interactive Claude Executor
 */

import { InteractiveClaudeExecutor } from './interactive-claude';
import { WaddleManager } from '../orchestrator';
import type { ExecutionRequest } from '../types';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';

// Mock child_process
jest.mock('child_process');

describe('InteractiveClaudeExecutor', () => {
  let executor: InteractiveClaudeExecutor;
  let mockManager: WaddleManager;
  let mockSpawn: jest.MockedFunction<typeof child_process.spawn>;
  
  const mockTask = {
    id: 1,
    featureId: 'test-feature',
    role: 'developer' as const,
    description: 'Implement test feature',
    status: 'in_progress' as const,
    attempts: 0,
    createdAt: new Date(),
  };

  const mockContext = [
    {
      id: 1,
      featureId: 'test-feature',
      type: 'architecture' as const,
      content: 'Architecture design',
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    executor = new InteractiveClaudeExecutor({
      timeout: 5000,
      maxRetries: 1,
    });
    
    mockManager = new WaddleManager();
    executor.setManager(mockManager);
    
    // Add error handler to prevent unhandled errors
    executor.on('error', () => {
      // Ignore errors in tests
    });
    
    mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;
  });

  afterEach(() => {
    // Clean up any remaining listeners
    executor.removeAllListeners();
    mockManager.removeAllListeners();
  });

  describe('execute', () => {
    it('should execute successfully when Claude calls reportTaskCompletion', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const executePromise = executor.execute(request);

      // Simulate Claude working
      mockProcess.stdout.emit('data', Buffer.from('Working on the task...\n'));
      
      // Simulate task completion via manager event
      setTimeout(() => {
        mockManager.emit('task:completed', {
          taskId: 1,
          featureId: 'test-feature',
          status: 'complete',
          output: {
            filesCreated: ['src/feature.ts'],
            filesModified: ['src/index.ts'],
            summary: 'Implemented feature',
            details: 'Created feature module',
          },
        });
      }, 100);

      // Wait a bit more then exit cleanly
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 200);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.output).toMatchObject({
        filesCreated: ['src/feature.ts'],
        filesModified: ['src/index.ts'],
        summary: 'Implemented feature',
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should fail if Claude exits without completion', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const executePromise = executor.execute(request);

      // Simulate Claude exiting without calling completion
      mockProcess.emit('exit', 0, null);

      const result = await executePromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claude exited without calling reportTaskCompletion');
    });

    it('should handle timeout', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const executor = new InteractiveClaudeExecutor({
        timeout: 100, // Very short timeout
        maxRetries: 1,
      });
      executor.setManager(mockManager);
      
      // Add error handler to prevent unhandled errors
      executor.on('error', () => {
        // Ignore errors in tests
      });

      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const executePromise = executor.execute(request);

      // Don't emit exit, let it timeout
      
      const result = await executePromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task timed out');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should emit stdout and stderr events', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const stdoutData: string[] = [];
      const stderrData: string[] = [];
      
      executor.on('stdout', ({ data }) => stdoutData.push(data));
      executor.on('stderr', ({ data }) => stderrData.push(data));

      const executePromise = executor.execute(request);

      // Emit some output
      mockProcess.stdout.emit('data', Buffer.from('Standard output\n'));
      mockProcess.stderr.emit('data', Buffer.from('Error output\n'));
      
      // Exit
      mockProcess.emit('exit', 1, null);

      await executePromise;

      expect(stdoutData).toContain('Standard output\n');
      expect(stderrData).toContain('Error output\n');
    });
  });

  describe('checkClaudeAvailable', () => {
    it('should return true when Claude is available', async () => {
      const mockProcess = new EventEmitter() as any;
      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = executor.checkClaudeAvailable();
      
      mockProcess.emit('exit', 0);
      
      const result = await checkPromise;
      expect(result).toBe(true);
    });

    it('should return false when Claude is not available', async () => {
      const mockProcess = new EventEmitter() as any;
      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = executor.checkClaudeAvailable();
      
      mockProcess.emit('error', new Error('Command not found'));
      
      const result = await checkPromise;
      expect(result).toBe(false);
    });
  });

  describe('prompt building', () => {
    it('should build correct prompt for developer task', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      let capturedPrompt = '';
      mockSpawn.mockImplementation((_cmd, args) => {
        if (args && args[1]) {
          capturedPrompt = args[1] as string;
        }
        return mockProcess as any;
      });

      const request: ExecutionRequest = {
        task: mockTask,
        role: 'developer',
        context: mockContext,
      };

      const executePromise = executor.execute(request);
      
      // Exit immediately
      mockProcess.emit('exit', 0, null);
      
      await executePromise;

      expect(capturedPrompt).toContain('task #1');
      expect(capturedPrompt).toContain('Role: developer');
      expect(capturedPrompt).toContain('Implement test feature');
      expect(capturedPrompt).toContain('reportTaskCompletion');
      expect(capturedPrompt).toContain('MCP server');
    });
  });
});