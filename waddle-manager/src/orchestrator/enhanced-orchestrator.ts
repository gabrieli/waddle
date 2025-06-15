/**
 * Enhanced orchestrator with self-healing capabilities
 */

import { EventEmitter } from 'events';
import type { Database } from 'better-sqlite3';
import { FeatureRepository, TaskRepository, ContextRepository, AuditLogRepository } from '../database/repositories';
import { HeadlessClaudeExecutor } from '../executor/headless-claude';
import { InteractiveClaudeExecutor } from '../executor/interactive-claude';
import type { Feature, Task, FeatureStatus, TaskStatus, Role } from '../types';

export interface OrchestratorConfig {
  checkIntervalMs?: number;
  maxConcurrentTasks?: number;
  taskTimeoutMs?: number;
  maxTaskAttempts?: number;
  selfHealingEnabled?: boolean;
  claudePath?: string;
  mcpServerUrl?: string;
}

interface RunningTask {
  task: Task;
  startTime: Date;
  executor: 'headless' | 'interactive';
}

export class EnhancedOrchestrator extends EventEmitter {
  private running = false;
  private paused = false;
  private checkInterval?: NodeJS.Timeout;
  private runningTasks = new Map<number, RunningTask>();
  
  private featureRepo: FeatureRepository;
  private taskRepo: TaskRepository;
  private contextRepo: ContextRepository;
  private auditRepo: AuditLogRepository;
  
  private headlessExecutor: HeadlessClaudeExecutor;
  private interactiveExecutor: InteractiveClaudeExecutor;
  
  private config: Required<OrchestratorConfig>;
  
  constructor(
    private db: Database,
    config: OrchestratorConfig = {}
  ) {
    super();
    
    // Initialize repositories
    this.featureRepo = new FeatureRepository(db);
    this.taskRepo = new TaskRepository(db);
    this.contextRepo = new ContextRepository(db);
    this.auditRepo = new AuditLogRepository(db);
    
    // Initialize executors
    this.headlessExecutor = new HeadlessClaudeExecutor({
      claudePath: config.claudePath
    });
    
    this.interactiveExecutor = new InteractiveClaudeExecutor({
      claudePath: config.claudePath,
      mcpServerUrl: config.mcpServerUrl
    });
    
    // Configure
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 30000,
      maxConcurrentTasks: config.maxConcurrentTasks ?? 2,
      taskTimeoutMs: config.taskTimeoutMs ?? 3600000,
      maxTaskAttempts: config.maxTaskAttempts ?? 3,
      selfHealingEnabled: config.selfHealingEnabled ?? true,
      claudePath: config.claudePath ?? 'claude',
      mcpServerUrl: config.mcpServerUrl ?? 'http://localhost:5173'
    };
    
    // Set up executor event handlers
    this.setupExecutorEvents();
  }
  
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Orchestrator is already running');
    }
    
    this.running = true;
    this.paused = false;
    
    this.emit('started');
    this.auditRepo.create('orchestrator', 'start', { config: this.config });
    
    // Start the check loop
    this.checkInterval = setInterval(() => {
      if (!this.paused) {
        this.processNextTasks().catch(error => {
          this.emit('error', error);
          
          // Self-healing: Create a task to investigate the error
          if (this.config.selfHealingEnabled) {
            this.createSelfHealingTask('orchestrator-error', error.message);
          }
        });
      }
    }, this.config.checkIntervalMs);
    
    // Process immediately
    await this.processNextTasks();
  }
  
  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('Orchestrator is not running');
    }
    
    this.running = false;
    this.paused = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    
    // Wait for running tasks to complete
    await this.waitForRunningTasks();
    
    this.emit('stopped');
    this.auditRepo.create('orchestrator', 'stop', {});
  }
  
  async pause(): Promise<void> {
    this.paused = true;
    this.emit('paused');
    this.auditRepo.create('orchestrator', 'pause', {});
  }
  
  async resume(): Promise<void> {
    this.paused = false;
    this.emit('resumed');
    this.auditRepo.create('orchestrator', 'resume', {});
  }
  
  private async processNextTasks(): Promise<void> {
    // Check if we can take more tasks
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }
    
    // Check for stuck tasks and handle them
    await this.checkStuckTasks();
    
    // Get pending tasks
    const availableSlots = this.config.maxConcurrentTasks - this.runningTasks.size;
    const pendingTasks = this.taskRepo.findPendingTasks(availableSlots);
    
    for (const task of pendingTasks) {
      // Skip if feature is paused or cancelled
      const feature = this.featureRepo.findById(task.featureId);
      if (!feature || feature.status === 'paused' || feature.status === 'cancelled') {
        continue;
      }
      
      // Check if task has exceeded max attempts
      if (task.attempts >= this.config.maxTaskAttempts) {
        await this.handleFailedTask(task, 'Max attempts exceeded');
        continue;
      }
      
      // Start the task
      await this.executeTask(task);
    }
  }
  
  private async executeTask(task: Task): Promise<void> {
    // Update task status
    this.taskRepo.update(task.id, {
      status: 'in_progress',
      startedAt: new Date()
    });
    
    this.taskRepo.incrementAttempts(task.id);
    
    // Determine executor
    const executor = task.role === 'developer' ? 'interactive' : 'headless';
    
    // Track running task
    this.runningTasks.set(task.id, {
      task,
      startTime: new Date(),
      executor
    });
    
    this.emit('task:started', { task });
    
    try {
      // Get context for the task
      const context = await this.buildTaskContext(task);
      
      // Execute based on role
      const result = executor === 'headless'
        ? await this.headlessExecutor.execute({
            role: task.role,
            task,
            context,
            timeout: this.config.taskTimeoutMs
          })
        : await this.interactiveExecutor.execute({
            role: task.role,
            task,
            context,
            timeout: this.config.taskTimeoutMs
          });
      
      if (result.success) {
        await this.handleSuccessfulTask(task, result.output);
      } else {
        await this.handleFailedTask(task, result.error || 'Unknown error');
      }
    } catch (error: any) {
      await this.handleFailedTask(task, error.message);
    } finally {
      this.runningTasks.delete(task.id);
    }
  }
  
  private async handleSuccessfulTask(task: Task, output: any): Promise<void> {
    // Update task
    this.taskRepo.update(task.id, {
      status: 'complete',
      completedAt: new Date(),
      output
    });
    
    // Store context for next tasks
    this.contextRepo.create({
      featureId: task.featureId,
      role: task.role,
      content: output,
      metadata: { taskId: task.id }
    });
    
    this.emit('task:completed', { task, output });
    
    // Check if feature is complete
    await this.checkFeatureCompletion(task.featureId);
    
    // Create next task in pipeline
    await this.createNextTask(task);
  }
  
  private async handleFailedTask(task: Task, error: string): Promise<void> {
    // Update task
    this.taskRepo.update(task.id, {
      status: 'failed',
      completedAt: new Date(),
      error
    });
    
    this.emit('task:failed', { task, error });
    
    // Self-healing: Analyze failure and potentially create fix task
    if (this.config.selfHealingEnabled && task.attempts < this.config.maxTaskAttempts) {
      await this.analyzefailureAndRecover(task, error);
    } else {
      // Update feature status to blocked if critical task failed
      const feature = this.featureRepo.findById(task.featureId);
      if (feature && feature.status === 'in_progress') {
        this.featureRepo.update(task.featureId, { status: 'blocked' });
        
        // Create a self-healing task to unblock
        if (this.config.selfHealingEnabled) {
          await this.createSelfHealingTask('unblock-feature', 
            `Feature ${task.featureId} is blocked due to task failure: ${error}`,
            { featureId: task.featureId, failedTask: task }
          );
        }
      }
    }
  }
  
  private async createNextTask(completedTask: Task): Promise<void> {
    const feature = this.featureRepo.findById(completedTask.featureId);
    if (!feature || feature.status !== 'in_progress') {
      return;
    }
    
    // Determine next role in pipeline
    const nextRole = this.getNextRole(completedTask.role);
    if (!nextRole) {
      return;
    }
    
    // Check if task already exists
    const existingTasks = this.taskRepo.findAll({
      featureId: completedTask.featureId,
      role: nextRole,
      status: ['pending', 'in_progress']
    });
    
    if (existingTasks.length > 0) {
      return;
    }
    
    // Create next task
    this.taskRepo.create({
      featureId: completedTask.featureId,
      role: nextRole,
      description: `${nextRole} task for feature: ${feature.description}`
    });
    
    this.emit('task:created', { featureId: completedTask.featureId, role: nextRole });
  }
  
  private getNextRole(currentRole: Role): Role | null {
    const pipeline: Record<Role, Role | null> = {
      'architect': 'developer',
      'developer': 'reviewer',
      'reviewer': null
    };
    
    return pipeline[currentRole];
  }
  
  private async checkFeatureCompletion(featureId: string): Promise<void> {
    const tasks = this.taskRepo.findByFeatureId(featureId);
    const allComplete = tasks.every(t => t.status === 'complete');
    
    if (allComplete && tasks.length >= 3) { // architect, developer, reviewer
      this.featureRepo.update(featureId, { 
        status: 'complete',
        completedAt: new Date()
      });
      
      this.emit('feature:completed', { featureId });
    }
  }
  
  private async checkStuckTasks(): Promise<void> {
    const now = Date.now();
    
    for (const [taskId, running] of this.runningTasks.entries()) {
      const runtime = now - running.startTime.getTime();
      
      if (runtime > this.config.taskTimeoutMs) {
        this.emit('task:timeout', { task: running.task });
        
        // Force fail the task
        await this.handleFailedTask(running.task, 'Task timed out');
        this.runningTasks.delete(taskId);
      }
    }
  }
  
  private async buildTaskContext(task: Task): Promise<Array<{ role: string; content: any }>> {
    // Get all context for the feature
    const contexts = this.contextRepo.findByFeatureId(task.featureId);
    
    // Get feature description
    const feature = this.featureRepo.findById(task.featureId);
    
    const result = [];
    
    if (feature) {
      result.push({
        role: 'feature',
        content: feature.description
      });
    }
    
    // Add relevant contexts based on role
    for (const ctx of contexts) {
      // Don't include context from the same role
      if (ctx.role !== task.role) {
        result.push({
          role: ctx.role,
          content: ctx.content
        });
      }
    }
    
    return result;
  }
  
  private async analyzefailureAndRecover(task: Task, error: string): Promise<void> {
    // Use AI to analyze the failure
    const analysisTask: Task = {
      id: -1, // Temporary
      featureId: 'waddle-self-healing',
      role: 'architect',
      description: `Analyze task failure and suggest recovery strategy: ${error}`,
      status: 'pending',
      attempts: 0,
      createdAt: new Date()
    };
    
    try {
      const result = await this.headlessExecutor.execute({
        role: 'architect',
        task: analysisTask,
        context: [
          { role: 'failed-task', content: { task, error } },
          { role: 'instruction', content: 'Analyze why this task failed and suggest a recovery strategy. Return JSON with: { retry: boolean, modifiedPrompt?: string, additionalContext?: string }' }
        ],
        timeout: 30000
      });
      
      if (result.success && result.output.retry) {
        // Retry with modifications
        if (result.output.modifiedPrompt) {
          task.description = result.output.modifiedPrompt;
        }
        
        // Reset status to pending for retry
        this.taskRepo.update(task.id, { status: 'pending' });
        
        if (result.output.additionalContext) {
          this.contextRepo.create({
            featureId: task.featureId,
            role: 'recovery-context',
            content: result.output.additionalContext
          });
        }
      }
    } catch (recoveryError) {
      // Recovery analysis failed, log it
      this.emit('self-healing:failed', { task, error: recoveryError });
    }
  }
  
  private async createSelfHealingTask(
    type: string, 
    description: string, 
    metadata?: any
  ): Promise<void> {
    // Check if self-healing feature exists
    let healingFeature = this.featureRepo.findAll({ 
      status: ['pending', 'in_progress'] 
    }).find(f => f.id === 'waddle-self-healing');
    
    if (!healingFeature) {
      healingFeature = this.featureRepo.create({
        description: 'Waddle Self-Healing: Automatic recovery and improvement tasks',
        priority: 'high',
        metadata: { system: true }
      });
    }
    
    // Create healing task
    this.taskRepo.create({
      featureId: healingFeature.id,
      role: 'architect',
      description: `[${type}] ${description}`
    });
    
    this.emit('self-healing:created', { type, description, metadata });
  }
  
  private async waitForRunningTasks(): Promise<void> {
    const maxWait = 60000; // 1 minute
    const startTime = Date.now();
    
    while (this.runningTasks.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.runningTasks.size > 0) {
      this.emit('warning', `Force stopping with ${this.runningTasks.size} tasks still running`);
    }
  }
  
  private setupExecutorEvents(): void {
    // Forward executor events
    this.headlessExecutor.on('attempt', data => this.emit('executor:attempt', data));
    this.headlessExecutor.on('retry', data => this.emit('executor:retry', data));
    this.headlessExecutor.on('stdout', data => this.emit('executor:stdout', data));
    this.headlessExecutor.on('stderr', data => this.emit('executor:stderr', data));
    
    this.interactiveExecutor.on('spawned', data => this.emit('executor:spawned', data));
    this.interactiveExecutor.on('stdout', data => this.emit('executor:stdout', data));
    this.interactiveExecutor.on('stderr', data => this.emit('executor:stderr', data));
    this.interactiveExecutor.on('exit', data => this.emit('executor:exit', data));
  }
  
  // Public methods for monitoring
  getRunningTasks(): Task[] {
    return Array.from(this.runningTasks.values()).map(rt => rt.task);
  }
  
  getMetrics(): any {
    const allTasks = this.taskRepo.findAll();
    const features = this.featureRepo.findAll();
    
    return {
      features: {
        total: features.length,
        pending: features.filter(f => f.status === 'pending').length,
        inProgress: features.filter(f => f.status === 'in_progress').length,
        complete: features.filter(f => f.status === 'complete').length,
        blocked: features.filter(f => f.status === 'blocked').length
      },
      tasks: {
        total: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        inProgress: allTasks.filter(t => t.status === 'in_progress').length,
        complete: allTasks.filter(t => t.status === 'complete').length,
        failed: allTasks.filter(t => t.status === 'failed').length
      },
      orchestrator: {
        running: this.running,
        paused: this.paused,
        runningTasks: this.runningTasks.size,
        maxConcurrent: this.config.maxConcurrentTasks
      }
    };
  }
}