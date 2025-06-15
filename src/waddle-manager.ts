import { EventEmitter } from 'events';
import { GitHubService } from './services/github-service';
import { LLMService } from './services/llm-service';
import { StateManager } from './state/state-manager';
import { Logger } from './logger';
import { Config } from './config';
import { AutonomousOrchestrator, OrchestratorConfig } from './orchestrator/autonomous-loop';
import { AIReasoner } from './orchestrator/ai-reasoner';

export interface WaddleManagerConfig {
  github: {
    token: string;
    owner: string;
    repo: string;
  };
  llm: {
    apiKey: string;
    model?: string;
  };
  orchestrator?: Partial<OrchestratorConfig>;
  workingDir?: string;
}

export class WaddleManager extends EventEmitter {
  private githubService: GitHubService;
  private llmService: LLMService;
  private stateManager: StateManager;
  private orchestrator?: AutonomousOrchestrator;
  private logger: Logger;
  private config: Config;
  private headlessExecutor: any;
  private interactiveExecutor: any;
  private defaultExecutor: any;

  constructor(config: WaddleManagerConfig) {
    super();
    
    this.logger = new Logger('WaddleManager');
    this.config = new Config(config.workingDir || process.cwd());
    
    this.githubService = new GitHubService({
      auth: config.github.token,
      owner: config.github.owner,
      repo: config.github.repo
    });
    
    this.llmService = new LLMService({
      apiKey: config.llm.apiKey,
      model: config.llm.model || 'claude-3-opus-20240229'
    });
    
    this.stateManager = new StateManager(
      this.config.getStateDir(),
      this.logger
    );

    this.initializeExecutors();
  }

  private initializeExecutors(): void {
    this.headlessExecutor = {
      execute: async (task: any, phase: string) => {
        this.logger.info(`Executing headless task for phase: ${phase}`);
        
        const prompt = this.getPhasePrompt(phase, task);
        const response = await this.llmService.complete(prompt);
        
        return {
          nextPhase: this.getNextPhase(phase),
          summary: response,
          createPR: phase === 'development',
          branch: phase === 'development' ? `feature/${task.issue.number}-${phase}` : undefined
        };
      }
    };

    this.interactiveExecutor = {
      execute: async (task: any, phase: string) => {
        this.logger.info(`Executing interactive task for phase: ${phase}`);
        
        const prompt = this.getPhasePrompt(phase, task);
        const response = await this.llmService.complete(prompt);
        
        return {
          nextPhase: this.getNextPhase(phase),
          summary: response,
          createPR: true,
          branch: `feature/${task.issue.number}-${phase}`
        };
      }
    };

    this.defaultExecutor = this.headlessExecutor;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Waddle Manager...');
    
    await this.config.load();
    await this.stateManager.initialize();
    
    const aiReasoner = new AIReasoner(this.llmService, this.logger);
    
    this.orchestrator = new AutonomousOrchestrator(
      this.githubService,
      aiReasoner,
      this,
      this.stateManager,
      this.logger,
      this.config.get('orchestrator')
    );
    
    this.setupOrchestratorEvents();
    
    this.logger.info('Waddle Manager initialized successfully');
  }

  private setupOrchestratorEvents(): void {
    if (!this.orchestrator) return;

    this.orchestrator.on('started', () => {
      this.emit('orchestrator:started');
    });

    this.orchestrator.on('stopped', () => {
      this.emit('orchestrator:stopped');
    });

    this.orchestrator.on('paused', () => {
      this.emit('orchestrator:paused');
    });

    this.orchestrator.on('resumed', () => {
      this.emit('orchestrator:resumed');
    });

    this.orchestrator.on('taskStarted', (data) => {
      this.emit('task:started', data);
    });

    this.orchestrator.on('taskCompleted', (data) => {
      this.emit('task:completed', data);
    });

    this.orchestrator.on('taskFailed', (data) => {
      this.emit('task:failed', data);
    });

    this.orchestrator.on('error', (error) => {
      this.logger.error('Orchestrator error', error);
      this.emit('error', error);
    });
  }

  async start(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }
    
    await this.orchestrator.start();
  }

  async stop(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }
    
    await this.orchestrator.stop();
  }

  async pause(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }
    
    await this.orchestrator.pause();
  }

  async resume(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }
    
    await this.orchestrator.resume();
  }

  getMetrics(): any {
    if (!this.orchestrator) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }
    
    return this.orchestrator.getMetrics();
  }

  getHeadlessExecutor(): any {
    return this.headlessExecutor;
  }

  getInteractiveExecutor(): any {
    return this.interactiveExecutor;
  }

  getDefaultExecutor(): any {
    return this.defaultExecutor;
  }

  private getPhasePrompt(phase: string, task: any): string {
    const prompts: Record<string, string> = {
      'technical-design': `
You are a Technical Architect working on the following task:

Issue: ${task.issue.title}
Description: ${task.issue.body}

Create a technical design that includes:
1. Architecture overview
2. Key components and their interactions
3. Data flow
4. Technology choices
5. Implementation approach

Provide a detailed technical design document.
`,
      'development': `
You are a Developer implementing the following task:

Issue: ${task.issue.title}
Description: ${task.issue.body}
Technical Design: ${task.state.history?.find((h: any) => h.phase === 'technical-design')?.result || 'Not available'}

Implement the solution following the technical design.
Focus on:
1. Clean, maintainable code
2. Proper error handling
3. Test coverage
4. Documentation

Provide a summary of the implementation.
`,
      'code-review': `
You are a Code Reviewer examining the following implementation:

Issue: ${task.issue.title}
Description: ${task.issue.body}
Implementation Summary: ${task.state.history?.find((h: any) => h.phase === 'development')?.result || 'Not available'}

Review the code for:
1. Correctness
2. Code quality
3. Best practices
4. Security concerns
5. Performance implications

Provide a detailed review with any required changes.
`,
      'testing': `
You are a QA Engineer testing the following implementation:

Issue: ${task.issue.title}
Description: ${task.issue.body}
Implementation: ${task.state.history?.find((h: any) => h.phase === 'development')?.result || 'Not available'}

Test the implementation:
1. Functional testing
2. Edge cases
3. Integration testing
4. Performance testing
5. Security testing

Provide a test report with pass/fail status and any issues found.
`
    };

    return prompts[phase] || `Execute ${phase} phase for task: ${task.issue.title}`;
  }

  private getNextPhase(currentPhase: string): string {
    const transitions: Record<string, string> = {
      'requirements': 'technical-design',
      'technical-design': 'development',
      'development': 'code-review',
      'code-review': 'testing',
      'testing': 'done'
    };

    return transitions[currentPhase] || 'done';
  }

  async createFeature(title: string, description: string, labels?: string[]): Promise<number> {
    const issue = await this.githubService.createIssue({
      title,
      body: description,
      labels: ['waddle:pending', ...(labels || [])]
    });

    await this.stateManager.saveIssueState(issue.number, {
      phase: 'requirements',
      createdAt: new Date(),
      lastUpdated: new Date(),
      history: []
    });

    this.logger.info(`Created feature issue #${issue.number}: ${title}`);
    return issue.number;
  }

  async getFeatureStatus(issueNumber: number): Promise<any> {
    const issue = await this.githubService.getIssue(issueNumber);
    const state = await this.stateManager.getIssueState(issueNumber);
    
    return {
      issue,
      state,
      isActive: this.orchestrator ? 
        Array.from((this.orchestrator as any).activeTasks.keys() as IterableIterator<string>)
          .some(taskId => taskId.startsWith(`${issueNumber}-`)) : 
        false
    };
  }

  async listFeatures(options?: { state?: 'open' | 'closed' | 'all'; labels?: string[] }): Promise<any[]> {
    const issues = await this.githubService.listIssues({
      state: options?.state || 'open',
      labels: options?.labels
    });

    const features = [];
    
    for (const issue of issues) {
      const state = await this.stateManager.getIssueState(issue.number);
      features.push({
        issue,
        state
      });
    }

    return features;
  }
}