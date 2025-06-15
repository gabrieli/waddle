import { EventEmitter } from 'events';
import { AutonomousOrchestrator, OrchestratorConfig } from '../autonomous-loop';
import { GitHubService } from '../../services/github-service';
import { AIReasoner } from '../ai-reasoner';
import { WaddleManager } from '../../waddle-manager';
import { Logger } from '../../logger';
import { StateManager } from '../../state/state-manager';

jest.mock('../../services/github-service');
jest.mock('../ai-reasoner');
jest.mock('../../waddle-manager');
jest.mock('../../logger');
jest.mock('../../state/state-manager');

describe('AutonomousOrchestrator', () => {
  let orchestrator: AutonomousOrchestrator;
  let mockGithubService: jest.Mocked<GitHubService>;
  let mockAIReasoner: jest.Mocked<AIReasoner>;
  let mockWaddleManager: jest.Mocked<WaddleManager>;
  let mockLogger: jest.Mocked<Logger>;
  let mockStateManager: jest.Mocked<StateManager>;

  const config: OrchestratorConfig = {
    checkIntervalMs: 100,
    maxConcurrentTasks: 2,
    taskTimeoutMs: 1000,
    retryAttempts: 2,
    retryDelayMs: 100
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockGithubService = new GitHubService({} as any) as jest.Mocked<GitHubService>;
    mockAIReasoner = new AIReasoner({} as any, {} as any) as jest.Mocked<AIReasoner>;
    mockWaddleManager = new WaddleManager({} as any) as jest.Mocked<WaddleManager>;
    mockLogger = new Logger('test') as jest.Mocked<Logger>;
    mockStateManager = new StateManager({} as any, {} as any) as jest.Mocked<StateManager>;
    
    // Set default mock behaviors
    mockAIReasoner.detectDeadlocks.mockResolvedValue([]);

    orchestrator = new AutonomousOrchestrator(
      mockGithubService,
      mockAIReasoner,
      mockWaddleManager,
      mockStateManager,
      mockLogger,
      config
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should start the orchestrator successfully', async () => {
      await orchestrator.start();

      expect(mockStateManager.saveOrchestratorState).toHaveBeenCalledWith({
        isRunning: true,
        isPaused: false,
        startTime: expect.any(Date)
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Starting Autonomous Orchestrator...');
      expect(mockLogger.info).toHaveBeenCalledWith('Autonomous Orchestrator started successfully');
    });

    it('should throw error if already running', async () => {
      await orchestrator.start();
      await expect(orchestrator.start()).rejects.toThrow('Orchestrator is already running');
    });

    it('should emit started event', async () => {
      const startedHandler = jest.fn();
      orchestrator.on('started', startedHandler);

      await orchestrator.start();

      expect(startedHandler).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the orchestrator successfully', async () => {
      await orchestrator.start();
      await orchestrator.stop();

      expect(mockStateManager.saveOrchestratorState).toHaveBeenCalledWith({
        isRunning: false,
        isPaused: false,
        startTime: undefined
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping Autonomous Orchestrator...');
      expect(mockLogger.info).toHaveBeenCalledWith('Autonomous Orchestrator stopped successfully');
    });

    it('should throw error if not running', async () => {
      await expect(orchestrator.stop()).rejects.toThrow('Orchestrator is not running');
    });

    it('should wait for active tasks to complete', async () => {
      await orchestrator.start();
      
      const mockTask = {
        issue: { number: 1, title: 'Test Issue' },
        state: { 
          phase: 'development',
          createdAt: new Date(),
          lastUpdated: new Date(),
          history: []
        },
        priority: 100
      };

      mockGithubService.listIssues.mockResolvedValue([mockTask.issue]);
      mockStateManager.getIssueState.mockResolvedValue(mockTask.state);
      mockAIReasoner.selectNextTask.mockResolvedValue(mockTask);
      mockAIReasoner.determineNextPhase.mockResolvedValue('code-review');

      const mockExecutor = {
        execute: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 500))
        )
      };
      mockWaddleManager.getDefaultExecutor.mockReturnValue(mockExecutor);

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();

      const stopPromise = orchestrator.stop();
      
      jest.advanceTimersByTime(600);
      await stopPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Waiting for'));
    });
  });

  describe('pause/resume', () => {
    it('should pause the orchestrator', async () => {
      await orchestrator.start();
      await orchestrator.pause();

      expect(mockStateManager.saveOrchestratorState).toHaveBeenCalledWith({
        isRunning: true,
        isPaused: true,
        startTime: expect.any(Date)
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Autonomous Orchestrator paused');
    });

    it('should resume the orchestrator', async () => {
      await orchestrator.start();
      await orchestrator.pause();
      await orchestrator.resume();

      expect(mockStateManager.saveOrchestratorState).toHaveBeenLastCalledWith({
        isRunning: true,
        isPaused: false,
        startTime: expect.any(Date)
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Autonomous Orchestrator resumed');
    });

    it('should not execute loop when paused', async () => {
      mockGithubService.listIssues.mockResolvedValue([]);

      await orchestrator.start();
      await orchestrator.pause();

      jest.advanceTimersByTime(config.checkIntervalMs * 3);

      expect(mockGithubService.listIssues).not.toHaveBeenCalled();
    });
  });

  describe('task execution', () => {
    let mockTask: any;
    let mockExecutor: any;

    beforeEach(() => {
      mockTask = {
        issue: { 
          number: 1, 
          title: 'Test Issue',
          created_at: new Date().toISOString(),
          labels: ['priority:high']
        },
        state: { 
          phase: 'development',
          createdAt: new Date(),
          lastUpdated: new Date(),
          history: []
        },
        priority: 100
      };

      mockExecutor = {
        execute: jest.fn().mockResolvedValue({
          nextPhase: 'code-review',
          summary: 'Development completed',
          createPR: true,
          branch: 'feature/test'
        })
      };

      mockGithubService.listIssues.mockResolvedValue([mockTask.issue]);
      mockStateManager.getIssueState.mockResolvedValue(mockTask.state);
      mockAIReasoner.selectNextTask.mockResolvedValue(mockTask);
      mockAIReasoner.determineNextPhase.mockResolvedValue('code-review');
      mockAIReasoner.detectDeadlocks.mockResolvedValue([]);
      mockWaddleManager.getInteractiveExecutor.mockReturnValue(mockExecutor);
    });

    it('should execute tasks from pending work', async () => {
      await orchestrator.start();

      // Wait for the interval to trigger
      await Promise.resolve();
      jest.advanceTimersByTime(config.checkIntervalMs);
      
      // Wait for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(mockGithubService.listIssues).toHaveBeenCalledWith({
        state: 'open',
        labels: ['waddle:pending', 'waddle:in-progress']
      });
      expect(mockAIReasoner.selectNextTask).toHaveBeenCalled();
      expect(mockExecutor.execute).toHaveBeenCalledWith(mockTask, 'code-review');
    });

    it('should handle task completion', async () => {
      const taskCompletedHandler = jest.fn();
      orchestrator.on('taskCompleted', taskCompletedHandler);

      await orchestrator.start();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockStateManager.saveIssueState).toHaveBeenCalledWith(1, expect.objectContaining({
        phase: 'code-review',
        lastUpdated: expect.any(Date)
      }));
      expect(mockGithubService.createPullRequest).toHaveBeenCalled();
      expect(mockGithubService.addComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('✅ Completed development phase')
      );
      expect(taskCompletedHandler).toHaveBeenCalled();
    });

    it('should handle task failure with retry', async () => {
      mockExecutor.execute.mockRejectedValueOnce(new Error('Task failed'));

      await orchestrator.start();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockStateManager.saveIssueState).toHaveBeenCalledWith(1, expect.objectContaining({
        retryCount: 1,
        nextRetry: expect.any(Date)
      }));
      expect(mockGithubService.addComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('❌ Failed to complete development phase')
      );
    });

    it('should mark task as blocked after max retries', async () => {
      mockTask.state.retryCount = 2;
      mockExecutor.execute.mockRejectedValue(new Error('Task failed'));

      await orchestrator.start();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockStateManager.saveIssueState).toHaveBeenCalledWith(1, expect.objectContaining({
        phase: 'blocked',
        blockedReason: 'Task failed',
        blockedAt: expect.any(Date)
      }));
      expect(mockGithubService.addLabel).toHaveBeenCalledWith(1, 'waddle:blocked');
    });

    it('should handle task timeout', async () => {
      const timeoutHandler = jest.fn();
      orchestrator.on('taskTimeout', timeoutHandler);

      mockExecutor.execute.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      await orchestrator.start();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();

      jest.advanceTimersByTime(config.taskTimeoutMs + 100);

      expect(timeoutHandler).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('timed out after')
      );
    });
  });

  describe('deadlock detection and resolution', () => {
    it('should detect and resolve deadlocks', async () => {
      const mockDeadlock = {
        type: 'circular' as const,
        tasks: [
          { issue: { number: 1 }, state: {}, priority: 100 },
          { issue: { number: 2 }, state: {}, priority: 90 }
        ],
        description: 'Circular dependency'
      };

      mockGithubService.listIssues.mockResolvedValue([
        { number: 1, labels: [] },
        { number: 2, labels: [] }
      ]);
      mockStateManager.getIssueState.mockResolvedValue({ 
        phase: 'development',
        createdAt: new Date(),
        lastUpdated: new Date(),
        history: []
      });
      mockAIReasoner.detectDeadlocks.mockResolvedValue([mockDeadlock]);
      mockAIReasoner.suggestDeadlockResolution.mockResolvedValue({
        action: 'prioritize',
        tasks: [
          { issue: { number: 1 }, newLabels: ['priority:critical'] }
        ],
        reason: 'Breaking circular dependency'
      });

      await orchestrator.start();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();

      expect(mockAIReasoner.detectDeadlocks).toHaveBeenCalled();
      expect(mockAIReasoner.suggestDeadlockResolution).toHaveBeenCalledWith(mockDeadlock);
      expect(mockGithubService.updateIssue).toHaveBeenCalledWith(1, {
        labels: ['priority:critical']
      });
    });
  });

  describe('metrics', () => {
    it('should track performance metrics', async () => {
      const mockTask = {
        issue: { number: 1, created_at: new Date().toISOString(), labels: [] },
        state: { 
          phase: 'development',
          createdAt: new Date(),
          lastUpdated: new Date(),
          history: []
        },
        priority: 100
      };

      mockGithubService.listIssues.mockResolvedValue([mockTask.issue]);
      mockStateManager.getIssueState.mockResolvedValue(mockTask.state);
      mockAIReasoner.selectNextTask.mockResolvedValue(mockTask);
      mockAIReasoner.determineNextPhase.mockResolvedValue('code-review');
      mockAIReasoner.detectDeadlocks.mockResolvedValue([]);

      const mockExecutor = {
        execute: jest.fn()
          .mockResolvedValueOnce({ nextPhase: 'code-review', summary: 'Success' })
          .mockRejectedValueOnce(new Error('Failed'))
      };
      mockWaddleManager.getDefaultExecutor.mockReturnValue(mockExecutor);

      await orchestrator.start();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();
      await Promise.resolve();

      const metrics = orchestrator.getMetrics();

      expect(metrics.tasksProcessed).toBe(2);
      expect(metrics.tasksSucceeded).toBe(1);
      expect(metrics.tasksFailed).toBe(1);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should emit error event on loop failure', async () => {
      const errorHandler = jest.fn();
      orchestrator.on('error', errorHandler);

      mockGithubService.listIssues.mockRejectedValue(new Error('API error'));

      await orchestrator.start();

      jest.advanceTimersByTime(config.checkIntervalMs);
      await Promise.resolve();

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in orchestrator loop',
        expect.any(Error)
      );
    });
  });
});