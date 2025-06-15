/**
 * Unit tests for Headless Claude Executor
 */

import { HeadlessClaudeExecutor } from './headless-claude';
import { buildPrompt, parseRoleOutput } from './role-prompts';
import type { ExecutorOptions } from './types';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';

// Mock child_process
jest.mock('child_process');

describe('HeadlessClaudeExecutor', () => {
  let executor: HeadlessClaudeExecutor;
  let mockSpawn: jest.MockedFunction<typeof child_process.spawn>;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new HeadlessClaudeExecutor({
      claudePath: '/usr/local/bin/claude',
      defaultModel: 'test-model',
      maxRetries: 2,
      retryDelay: 100,
      timeout: 1000,
    });

    mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;
  });

  describe('execute', () => {
    const mockTask = {
      id: 1,
      featureId: 'test-feature',
      role: 'developer' as const,
      description: 'Implement test feature',
      status: 'pending' as const,
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

    const mockOptions: ExecutorOptions = {
      role: 'developer',
      task: mockTask,
      context: mockContext,
    };

    it('should execute successfully with valid output', async () => {
      const mockOutput = JSON.stringify({
        filesCreated: ['test.ts'],
        filesModified: [],
        testsAdded: ['test.test.ts'],
        implementation: {
          summary: 'Test implementation',
          details: 'Implemented test feature',
        },
      });

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const executePromise = executor.execute(mockOptions);

      // Simulate successful execution
      mockProcess.stdout.emit('data', Buffer.from(mockOutput));
      mockProcess.emit('exit', 0, null);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        filesCreated: ['test.ts'],
        filesModified: [],
        testsAdded: ['test.test.ts'],
        implementation: {
          summary: 'Test implementation',
          details: 'Implemented test feature',
        },
      });
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should retry on failure', async () => {
      // Create a simpler test that doesn't rely on complex timing
      const executor = new HeadlessClaudeExecutor({
        maxRetries: 2,
        retryDelay: 10, // Very short delay for testing
        timeout: 1000,
      });

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();
        mockProcess.killed = false;

        // First call fails, second succeeds
        if (callCount === 1) {
          setImmediate(() => {
            mockProcess.stderr.emit('data', Buffer.from('Error occurred'));
            mockProcess.emit('exit', 1, null);
          });
        } else {
          const mockOutput = JSON.stringify({
            filesCreated: ['test.ts'],
            filesModified: [],
            testsAdded: ['test.test.ts'],
            implementation: {
              summary: 'Test implementation',
              details: 'Implemented test feature',
            },
          });
          setImmediate(() => {
            mockProcess.stdout.emit('data', Buffer.from(mockOutput));
            mockProcess.emit('exit', 0, null);
          });
        }

        return mockProcess;
      });

      const result = await executor.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(callCount).toBe(2);
    });

    it('should fail after max retries', async () => {
      // Create executor with short delays for testing
      const executor = new HeadlessClaudeExecutor({
        maxRetries: 2,
        retryDelay: 10,
        timeout: 1000,
      });

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();
        mockProcess.killed = false;

        // All attempts fail
        setImmediate(() => {
          mockProcess.stderr.emit('data', Buffer.from('Error occurred'));
          mockProcess.emit('exit', 1, null);
        });

        return mockProcess;
      });

      const result = await executor.execute(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed after 2 attempts');
      expect(callCount).toBe(2);
    });

    it.skip('should handle timeout', async () => {
      jest.useFakeTimers();
      
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const executePromise = executor.execute({
        ...mockOptions,
        timeout: 100, // Very short timeout
      });

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(100);

      // Process should be killed
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Simulate the process being killed and exiting
      mockProcess.emit('exit', null, 'SIGTERM');

      const result = await executePromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Process timed out');

      jest.useRealTimers();
    });

    it.skip('should handle Claude not found', async () => {
      mockSpawn.mockImplementation(() => {
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();
        mockProcess.killed = false;
        
        // Simulate ENOENT error on spawn
        setImmediate(() => {
          const error = new Error('spawn claude ENOENT') as any;
          error.code = 'ENOENT';
          mockProcess.emit('error', error);
        });
        
        return mockProcess;
      });

      const result = await executor.execute(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claude executable not found');
    });
  });

  describe('checkClaudeAvailable', () => {
    it('should return true when Claude is available', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();

      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = executor.checkClaudeAvailable();

      mockProcess.stdout.emit('data', Buffer.from('ok'));
      mockProcess.emit('exit', 0, null);

      const result = await checkPromise;
      expect(result).toBe(true);
    });

    it('should return false when Claude is not available', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn claude ENOENT');
      });

      const result = await executor.checkClaudeAvailable();
      expect(result).toBe(false);
    });
  });
});

describe('Role Prompts', () => {
  describe('buildPrompt', () => {
    it('should build architect prompt correctly', () => {
      const prompt = buildPrompt(
        'architect',
        'Design user authentication',
        ['Previous design patterns', 'Security requirements'],
        'Consider OAuth2 integration'
      );

      expect(prompt).toContain('technical architect');
      expect(prompt).toContain('Design user authentication');
      expect(prompt).toContain('Previous design patterns');
      expect(prompt).toContain('Security requirements');
      expect(prompt).toContain('Consider OAuth2 integration');
      expect(prompt).toContain('OUTPUT FORMAT');
    });

    it('should build developer prompt correctly', () => {
      const prompt = buildPrompt(
        'developer',
        'Implement login endpoint',
        ['API specification'],
      );

      expect(prompt).toContain('developer for Waddle');
      expect(prompt).toContain('Implement login endpoint');
      expect(prompt).toContain('API specification');
      expect(prompt).toContain('TDD practices');
    });

    it('should build reviewer prompt correctly', () => {
      const prompt = buildPrompt(
        'reviewer',
        'Review authentication implementation',
        ['Implementation code', 'Test results'],
      );

      expect(prompt).toContain('code reviewer');
      expect(prompt).toContain('Review authentication implementation');
      expect(prompt).toContain('security vulnerabilities');
    });
  });

  describe('parseRoleOutput', () => {
    it('should parse valid architect JSON output', () => {
      const output = JSON.stringify({
        design: {
          overview: 'Microservices architecture',
          components: [
            {
              name: 'AuthService',
              description: 'Handles authentication',
              responsibilities: ['Login', 'Token generation'],
            },
          ],
          dataFlow: 'Client -> Gateway -> AuthService',
          dependencies: ['JWT library'],
        },
        implementation: {
          approach: 'Phased rollout',
          phases: ['Phase 1', 'Phase 2'],
          risks: ['Token security'],
        },
      });

      const result = parseRoleOutput('architect', output);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('design');
      expect(result.data).toHaveProperty('implementation');
    });

    it('should parse JSON with markdown code blocks', () => {
      const output = `Here's my design:

\`\`\`json
{
  "design": {
    "overview": "Simple design",
    "components": [],
    "dataFlow": "Direct",
    "dependencies": []
  },
  "implementation": {
    "approach": "Direct",
    "phases": ["One phase"],
    "risks": []
  }
}
\`\`\``;

      const result = parseRoleOutput('architect', output);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('design');
    });

    it('should handle invalid JSON', () => {
      const output = 'This is not JSON';
      const result = parseRoleOutput('architect', output);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse JSON');
      expect(result.logs).toContain(output);
    });
  });
});