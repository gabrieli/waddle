import { AIReasoner, Task, Deadlock } from '../ai-reasoner';
import { LLMService } from '../../services/llm-service';
import { Logger } from '../../logger';

jest.mock('../../services/llm-service');
jest.mock('../../logger');

describe('AIReasoner', () => {
  let aiReasoner: AIReasoner;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLLMService = new LLMService({} as any) as jest.Mocked<LLMService>;
    mockLogger = new Logger('test') as jest.Mocked<Logger>;
    
    aiReasoner = new AIReasoner(mockLLMService, mockLogger);
  });

  describe('selectNextTask', () => {
    const createTask = (id: number, priority: string, phase: string, createdDaysAgo: number = 0): Task => ({
      issue: {
        number: id,
        title: `Issue ${id}`,
        created_at: new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
        labels: [`priority:${priority}`]
      },
      state: { phase },
      priority: priority === 'high' ? 100 : priority === 'medium' ? 50 : 10
    });

    it('should select task based on AI recommendation', async () => {
      const tasks = [
        createTask(1, 'low', 'development'),
        createTask(2, 'high', 'requirements'),
        createTask(3, 'medium', 'technical-design')
      ];

      mockLLMService.complete.mockResolvedValue(JSON.stringify({
        selectedTaskId: 2,
        reason: 'High priority requirements task'
      }));

      const result = await aiReasoner.selectNextTask(tasks, new Map());

      expect(result).toBe(tasks[1]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AI selected task 2: High priority requirements task'
      );
    });

    it('should fallback to first task if AI selection fails', async () => {
      const tasks = [
        createTask(1, 'high', 'development'),
        createTask(2, 'low', 'requirements')
      ];

      mockLLMService.complete.mockRejectedValue(new Error('LLM error'));

      const result = await aiReasoner.selectNextTask(tasks, new Map());

      expect(result).toBe(tasks[0]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in AI task selection',
        expect.any(Error)
      );
    });

    it('should return null for empty task list', async () => {
      const result = await aiReasoner.selectNextTask([], new Map());
      expect(result).toBeNull();
    });

    it('should fallback if AI selects invalid task', async () => {
      const tasks = [
        createTask(1, 'medium', 'development'),
        createTask(2, 'low', 'testing')
      ];

      mockLLMService.complete.mockResolvedValue(JSON.stringify({
        selectedTaskId: 999,
        reason: 'Invalid task'
      }));

      const result = await aiReasoner.selectNextTask(tasks, new Map());

      expect(result).toBe(tasks[0]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AI selected invalid task, falling back to priority order'
      );
    });
  });

  describe('determineNextPhase', () => {
    it('should return single valid transition', async () => {
      const task: Task = {
        issue: { number: 1, title: 'Test Issue', body: 'Description' },
        state: { phase: 'requirements', history: [] },
        priority: 100
      };

      const result = await aiReasoner.determineNextPhase(task);
      expect(result).toBe('technical-design');
    });

    it('should use AI for multiple possible transitions', async () => {
      const task: Task = {
        issue: { number: 1, title: 'Test Issue', body: 'Failed tests' },
        state: { 
          phase: 'code-review',
          history: [{ phase: 'development', result: 'Issues found' }]
        },
        priority: 100
      };

      mockLLMService.complete.mockResolvedValue(JSON.stringify({
        nextPhase: 'development',
        reason: 'Code review found issues'
      }));

      const result = await aiReasoner.determineNextPhase(task);
      
      expect(result).toBe('development');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AI determined next phase: development - Code review found issues'
      );
    });

    it('should fallback on AI error', async () => {
      const task: Task = {
        issue: { number: 1, title: 'Test Issue' },
        state: { phase: 'testing' },
        priority: 100
      };

      mockLLMService.complete.mockRejectedValue(new Error('LLM error'));

      const result = await aiReasoner.determineNextPhase(task);
      
      expect(result).toBe('done');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw for invalid phase', async () => {
      const task: Task = {
        issue: { number: 1, title: 'Test Issue' },
        state: { phase: 'invalid-phase' },
        priority: 100
      };

      await expect(aiReasoner.determineNextPhase(task))
        .rejects.toThrow('No valid transitions from phase: invalid-phase');
    });
  });

  describe('detectDeadlocks', () => {
    it('should detect circular dependencies', async () => {
      const tasks: Task[] = [
        {
          issue: { 
            number: 1, 
            title: 'Issue 1',
            body: 'depends on #2'
          },
          state: { phase: 'development' },
          priority: 100
        },
        {
          issue: { 
            number: 2, 
            title: 'Issue 2',
            body: 'depends on #3'
          },
          state: { phase: 'development' },
          priority: 90
        },
        {
          issue: { 
            number: 3, 
            title: 'Issue 3',
            body: 'depends on #1'
          },
          state: { phase: 'development' },
          priority: 80
        }
      ];

      const deadlocks = await aiReasoner.detectDeadlocks(tasks);

      expect(deadlocks).toHaveLength(1);
      expect(deadlocks[0].type).toBe('circular');
      expect(deadlocks[0].tasks).toHaveLength(3);
      expect(deadlocks[0].description).toContain('Circular dependency detected');
    });

    it('should detect resource conflicts', async () => {
      const tasks: Task[] = [
        {
          issue: { 
            number: 1,
            title: 'Issue 1',
            body: 'Modifying config.js',
            assignee: 'dev1'
          },
          state: { phase: 'development' },
          priority: 100
        },
        {
          issue: { 
            number: 2,
            title: 'Issue 2',
            body: 'Also updating config.js',
            assignee: 'dev2'
          },
          state: { phase: 'development' },
          priority: 90
        }
      ];

      const deadlocks = await aiReasoner.detectDeadlocks(tasks);

      const resourceDeadlock = deadlocks.find(d => d.type === 'resource');
      expect(resourceDeadlock).toBeDefined();
      expect(resourceDeadlock!.description).toContain('Resource conflict on "file:config.js"');
    });

    it('should detect dependency blocks', async () => {
      const tasks: Task[] = [
        {
          issue: { 
            number: 1,
            title: 'Blocked Issue',
            body: 'depends on #2'
          },
          state: { phase: 'blocked' },
          priority: 100
        },
        {
          issue: { 
            number: 2,
            title: 'Blocking Issue'
          },
          state: { phase: 'development' },
          priority: 90
        }
      ];

      const deadlocks = await aiReasoner.detectDeadlocks(tasks);

      const depDeadlock = deadlocks.find(d => d.type === 'dependency');
      expect(depDeadlock).toBeDefined();
      expect(depDeadlock!.description).toContain('Task #1 is blocked by: #2');
    });
  });

  describe('suggestDeadlockResolution', () => {
    it('should suggest prioritization for circular deadlock', async () => {
      const deadlock: Deadlock = {
        type: 'circular',
        tasks: [
          {
            issue: { number: 1, title: 'Issue 1', labels: ['priority:medium'] },
            state: { phase: 'development' },
            priority: 50
          },
          {
            issue: { number: 2, title: 'Issue 2', labels: ['priority:low'] },
            state: { phase: 'development' },
            priority: 10
          }
        ],
        description: 'Circular dependency'
      };

      mockLLMService.complete.mockResolvedValue(JSON.stringify({
        action: 'prioritize',
        targetTaskId: 1,
        reason: 'Breaking cycle by prioritizing task 1',
        details: {}
      }));

      const resolution = await aiReasoner.suggestDeadlockResolution(deadlock);

      expect(resolution.action).toBe('prioritize');
      expect(resolution.tasks).toBeDefined();
      expect(resolution.reason).toContain('Breaking cycle');
    });

    it('should suggest unblock action', async () => {
      const deadlock: Deadlock = {
        type: 'dependency',
        tasks: [
          {
            issue: { number: 1, title: 'Blocked' },
            state: { phase: 'blocked' },
            priority: 100
          }
        ],
        description: 'Task blocked'
      };

      mockLLMService.complete.mockResolvedValue(JSON.stringify({
        action: 'unblock',
        targetTaskId: 1,
        reason: 'Force unblock to continue',
        details: {}
      }));

      const resolution = await aiReasoner.suggestDeadlockResolution(deadlock);

      expect(resolution.action).toBe('unblock');
      expect(resolution.task).toBeDefined();
    });

    it('should fallback to wait on error', async () => {
      const deadlock: Deadlock = {
        type: 'resource',
        tasks: [],
        description: 'Resource conflict'
      };

      mockLLMService.complete.mockRejectedValue(new Error('LLM error'));

      const resolution = await aiReasoner.suggestDeadlockResolution(deadlock);

      expect(resolution.action).toBe('wait');
      expect(resolution.reason).toBe('Unable to determine resolution strategy');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});