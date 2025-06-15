import { EventEmitter } from 'events';
import { GitHubService } from '../services/github-service';
import { AIReasoner } from './ai-reasoner';
import { WaddleManager } from '../waddle-manager';
import { Logger } from '../logger';
import { StateManager } from '../state/state-manager';
import { Config } from '../config';

export interface OrchestratorConfig {
  checkIntervalMs: number;
  maxConcurrentTasks: number;
  taskTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface TaskExecution {
  taskId: string;
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
  executor?: string;
  error?: Error;
}

export interface PerformanceMetrics {
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  averageExecutionTime: number;
  uptime: number;
  deadlocksDetected: number;
  deadlocksResolved: number;
}

export class AutonomousOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private loopInterval?: NodeJS.Timeout;
  private activeTasks: Map<string, TaskExecution> = new Map();
  private metrics: PerformanceMetrics = {
    tasksProcessed: 0,
    tasksSucceeded: 0,
    tasksFailed: 0,
    averageExecutionTime: 0,
    uptime: 0,
    deadlocksDetected: 0,
    deadlocksResolved: 0
  };
  private startTime?: Date;
  
  constructor(
    private githubService: GitHubService,
    private aiReasoner: AIReasoner,
    private waddleManager: WaddleManager,
    private stateManager: StateManager,
    private logger: Logger,
    config: Partial<OrchestratorConfig> = {}
  ) {
    super();
    this.config = {
      checkIntervalMs: config.checkIntervalMs || 30000,
      maxConcurrentTasks: config.maxConcurrentTasks || 1,
      taskTimeoutMs: config.taskTimeoutMs || 3600000,
      retryAttempts: config.retryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 60000
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }

    this.logger.info('Starting Autonomous Orchestrator...');
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = new Date();
    
    await this.stateManager.saveOrchestratorState({
      isRunning: true,
      isPaused: false,
      startTime: this.startTime
    });

    this.loopInterval = setInterval(() => {
      if (!this.isPaused) {
        this.executeLoop().catch(error => {
          this.logger.error('Error in orchestrator loop', error);
          this.emit('error', error);
        });
      }
    }, this.config.checkIntervalMs);

    this.emit('started');
    this.logger.info('Autonomous Orchestrator started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Orchestrator is not running');
    }

    this.logger.info('Stopping Autonomous Orchestrator...');
    
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = undefined;
    }

    await this.waitForActiveTasks();
    
    this.isRunning = false;
    this.isPaused = false;
    
    await this.stateManager.saveOrchestratorState({
      isRunning: false,
      isPaused: false,
      startTime: undefined
    });

    this.emit('stopped');
    this.logger.info('Autonomous Orchestrator stopped successfully');
  }

  async pause(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Orchestrator is not running');
    }

    this.logger.info('Pausing Autonomous Orchestrator...');
    this.isPaused = true;
    
    await this.stateManager.saveOrchestratorState({
      isRunning: true,
      isPaused: true,
      startTime: this.startTime
    });

    this.emit('paused');
    this.logger.info('Autonomous Orchestrator paused');
  }

  async resume(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Orchestrator is not running');
    }

    if (!this.isPaused) {
      throw new Error('Orchestrator is not paused');
    }

    this.logger.info('Resuming Autonomous Orchestrator...');
    this.isPaused = false;
    
    await this.stateManager.saveOrchestratorState({
      isRunning: true,
      isPaused: false,
      startTime: this.startTime
    });

    this.emit('resumed');
    this.logger.info('Autonomous Orchestrator resumed');
  }

  getMetrics(): PerformanceMetrics {
    const uptime = this.startTime 
      ? (Date.now() - this.startTime.getTime()) / 1000 
      : 0;

    return {
      ...this.metrics,
      uptime
    };
  }

  private async executeLoop(): Promise<void> {
    try {
      if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
        this.logger.debug('Max concurrent tasks reached, skipping loop');
        return;
      }

      const pendingWork = await this.findPendingWork();
      
      if (pendingWork.length === 0) {
        this.logger.debug('No pending work found');
        return;
      }

      const deadlocks = await this.aiReasoner.detectDeadlocks(pendingWork);
      if (deadlocks && deadlocks.length > 0) {
        this.metrics.deadlocksDetected += deadlocks.length;
        this.logger.warn(`Detected ${deadlocks.length} deadlocks, attempting resolution...`);
        
        for (const deadlock of deadlocks) {
          const resolved = await this.resolveDeadlock(deadlock);
          if (resolved) {
            this.metrics.deadlocksResolved++;
          }
        }
      }

      const nextTask = await this.aiReasoner.selectNextTask(pendingWork, this.activeTasks);
      
      if (nextTask) {
        await this.executeTask(nextTask);
      }
    } catch (error) {
      this.logger.error('Error in orchestrator loop execution', error);
      throw error;
    }
  }

  private async findPendingWork(): Promise<any[]> {
    const issues = await this.githubService.listIssues({
      state: 'open',
      labels: ['waddle:pending', 'waddle:in-progress']
    });

    const pendingWork = [];

    for (const issue of issues) {
      const state = await this.stateManager.getIssueState(issue.number);
      
      if (state && this.canTransition(state)) {
        pendingWork.push({
          issue,
          state,
          priority: this.calculatePriority(issue, state)
        });
      }
    }

    return pendingWork.sort((a, b) => b.priority - a.priority);
  }

  private canTransition(state: any): boolean {
    const allowedTransitions: Record<string, string[]> = {
      'requirements': ['technical-design'],
      'technical-design': ['development'],
      'development': ['code-review'],
      'code-review': ['testing'],
      'testing': ['done', 'development'],
      'blocked': ['development', 'technical-design']
    };

    return allowedTransitions[state.phase]?.length > 0;
  }

  private calculatePriority(issue: any, state: any): number {
    let priority = 0;

    const labels = Array.isArray(issue.labels) ? 
      issue.labels.map((l: any) => typeof l === 'string' ? l : l.name) : 
      [];

    if (labels.includes('priority:high')) priority += 100;
    if (labels.includes('priority:medium')) priority += 50;
    if (labels.includes('priority:low')) priority += 10;

    const ageInDays = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24);
    priority += Math.min(ageInDays * 2, 50);

    if (state.phase === 'blocked') priority -= 20;

    return priority;
  }

  private async executeTask(task: any): Promise<void> {
    const taskId = `${task.issue.number}-${task.state.phase}`;
    const startTime = new Date();

    this.activeTasks.set(taskId, {
      taskId,
      startTime,
      status: 'running'
    });

    this.emit('taskStarted', { taskId, task });
    this.logger.info(`Starting task execution: ${taskId}`);

    try {
      const nextPhase = await this.aiReasoner.determineNextPhase(task);
      const executor = this.selectExecutor(nextPhase);

      const taskTimeout = setTimeout(() => {
        this.handleTaskTimeout(taskId);
      }, this.config.taskTimeoutMs);

      const result = await executor.execute(task, nextPhase);
      
      clearTimeout(taskTimeout);

      await this.processTaskResult(task, result);
      
      const execution = this.activeTasks.get(taskId)!;
      execution.status = 'completed';
      
      this.updateMetrics(execution);
      this.activeTasks.delete(taskId);
      
      this.emit('taskCompleted', { taskId, task, result });
      this.logger.info(`Task completed successfully: ${taskId}`);
    } catch (error) {
      await this.handleTaskError(taskId, task, error as Error);
    }
  }

  private selectExecutor(phase: string): any {
    const headlessPhases = ['technical-design', 'code-review'];
    const interactivePhases = ['development'];

    if (headlessPhases.includes(phase)) {
      return this.waddleManager.getHeadlessExecutor();
    } else if (interactivePhases.includes(phase)) {
      return this.waddleManager.getInteractiveExecutor();
    } else {
      return this.waddleManager.getDefaultExecutor();
    }
  }

  private async processTaskResult(task: any, result: any): Promise<void> {
    const newState = {
      ...task.state,
      phase: result.nextPhase,
      lastUpdated: new Date(),
      history: [
        ...task.state.history,
        {
          phase: task.state.phase,
          timestamp: new Date(),
          result: result.summary
        }
      ]
    };

    await this.stateManager.saveIssueState(task.issue.number, newState);

    if (result.createPR && result.branch) {
      await this.githubService.createPullRequest({
        title: `${task.issue.title} - ${result.phase}`,
        body: result.summary,
        head: result.branch,
        base: 'main',
        issue: task.issue.number
      });
    }

    await this.githubService.addComment(
      task.issue.number,
      `✅ Completed ${task.state.phase} phase\n\n${result.summary}`
    );
  }

  private async handleTaskError(taskId: string, task: any, error: Error): Promise<void> {
    const execution = this.activeTasks.get(taskId);
    if (!execution) {
      this.logger.error(`No execution found for task ${taskId}`);
      return;
    }
    
    execution.status = 'failed';
    execution.error = error;
    
    this.updateMetrics(execution);
    this.activeTasks.delete(taskId);
    
    this.emit('taskFailed', { taskId, task, error });
    this.logger.error(`Task failed: ${taskId}`, error);

    await this.githubService.addComment(
      task.issue.number,
      `❌ Failed to complete ${task.state.phase} phase\n\nError: ${error.message}`
    );

    const retryCount = task.state.retryCount || 0;
    if (retryCount < this.config.retryAttempts) {
      await this.scheduleRetry(task, retryCount + 1);
    } else {
      await this.markAsBlocked(task, error);
    }
  }

  private async scheduleRetry(task: any, retryCount: number): Promise<void> {
    const newState = {
      ...task.state,
      retryCount,
      nextRetry: new Date(Date.now() + this.config.retryDelayMs)
    };

    await this.stateManager.saveIssueState(task.issue.number, newState);
    
    this.logger.info(`Scheduled retry ${retryCount} for task ${task.issue.number}`);
  }

  private async markAsBlocked(task: any, error: Error): Promise<void> {
    const newState = {
      ...task.state,
      phase: 'blocked',
      blockedReason: error.message,
      blockedAt: new Date()
    };

    await this.stateManager.saveIssueState(task.issue.number, newState);
    await this.githubService.addLabel(task.issue.number, 'waddle:blocked');
    
    this.logger.warn(`Task ${task.issue.number} marked as blocked after max retries`);
  }

  private async resolveDeadlock(deadlock: any): Promise<boolean> {
    try {
      const resolution = await this.aiReasoner.suggestDeadlockResolution(deadlock);
      
      if (resolution.action === 'prioritize' && resolution.tasks) {
        await this.reprioritizeTasks(resolution.tasks);
        return true;
      } else if (resolution.action === 'unblock' && resolution.task) {
        await this.unblockTask(resolution.task);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to resolve deadlock', error);
      return false;
    }
  }

  private async reprioritizeTasks(tasks: any[]): Promise<void> {
    for (const task of tasks) {
      await this.githubService.updateIssue(task.issue.number, {
        labels: task.newLabels
      });
    }
  }

  private async unblockTask(task: any): Promise<void> {
    const newState = {
      ...task.state,
      phase: task.previousPhase || 'development',
      blockedReason: undefined,
      blockedAt: undefined
    };

    await this.stateManager.saveIssueState(task.issue.number, newState);
    await this.githubService.removeLabel(task.issue.number, 'waddle:blocked');
  }

  private handleTaskTimeout(taskId: string): void {
    const execution = this.activeTasks.get(taskId);
    if (execution && execution.status === 'running') {
      this.logger.error(`Task ${taskId} timed out after ${this.config.taskTimeoutMs}ms`);
      execution.status = 'failed';
      execution.error = new Error('Task execution timeout');
      this.emit('taskTimeout', { taskId });
    }
  }

  private updateMetrics(execution: TaskExecution): void {
    this.metrics.tasksProcessed++;
    
    if (execution.status === 'completed') {
      this.metrics.tasksSucceeded++;
    } else {
      this.metrics.tasksFailed++;
    }

    const executionTime = Date.now() - execution.startTime.getTime();
    const totalExecutionTime = this.metrics.averageExecutionTime * (this.metrics.tasksProcessed - 1);
    this.metrics.averageExecutionTime = (totalExecutionTime + executionTime) / this.metrics.tasksProcessed;
  }

  private async waitForActiveTasks(): Promise<void> {
    const maxWaitTime = 60000;
    const startTime = Date.now();

    while (this.activeTasks.size > 0 && Date.now() - startTime < maxWaitTime) {
      this.logger.info(`Waiting for ${this.activeTasks.size} active tasks to complete...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    if (this.activeTasks.size > 0) {
      this.logger.warn(`Force stopping with ${this.activeTasks.size} active tasks`);
    }
  }
}