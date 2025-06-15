import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logger';

export interface IssueState {
  phase: string;
  createdAt: Date;
  lastUpdated: Date;
  history: Array<{
    phase: string;
    timestamp: Date;
    result?: string;
  }>;
  retryCount?: number;
  nextRetry?: Date;
  blockedReason?: string;
  blockedAt?: Date;
}

export interface OrchestratorState {
  isRunning: boolean;
  isPaused: boolean;
  startTime?: Date;
}

export class StateManager {
  private issueStatesPath: string;
  private orchestratorStatePath: string;

  constructor(
    private stateDir: string,
    private logger: Logger
  ) {
    this.issueStatesPath = path.join(stateDir, 'issues');
    this.orchestratorStatePath = path.join(stateDir, 'orchestrator.json');
  }

  async initialize(): Promise<void> {
    await this.ensureDirectories();
  }

  async saveIssueState(issueNumber: number, state: IssueState): Promise<void> {
    const filePath = path.join(this.issueStatesPath, `${issueNumber}.json`);
    
    try {
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(state, null, 2),
        'utf-8'
      );
      this.logger.debug(`Saved state for issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(`Failed to save state for issue #${issueNumber}`, error);
      throw error;
    }
  }

  async getIssueState(issueNumber: number): Promise<IssueState | null> {
    const filePath = path.join(this.issueStatesPath, `${issueNumber}.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const state = JSON.parse(content);
      
      state.createdAt = new Date(state.createdAt);
      state.lastUpdated = new Date(state.lastUpdated);
      
      if (state.history) {
        state.history = state.history.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        }));
      }
      
      if (state.nextRetry) {
        state.nextRetry = new Date(state.nextRetry);
      }
      
      if (state.blockedAt) {
        state.blockedAt = new Date(state.blockedAt);
      }
      
      return state;
    } catch (error) {
      this.logger.error(`Failed to load state for issue #${issueNumber}`, error);
      return null;
    }
  }

  async deleteIssueState(issueNumber: number): Promise<void> {
    const filePath = path.join(this.issueStatesPath, `${issueNumber}.json`);
    
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.debug(`Deleted state for issue #${issueNumber}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete state for issue #${issueNumber}`, error);
      throw error;
    }
  }

  async listIssueStates(): Promise<Map<number, IssueState>> {
    const states = new Map<number, IssueState>();
    
    try {
      const files = await fs.promises.readdir(this.issueStatesPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const issueNumber = parseInt(file.replace('.json', ''));
          const state = await this.getIssueState(issueNumber);
          
          if (state) {
            states.set(issueNumber, state);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to list issue states', error);
    }
    
    return states;
  }

  async saveOrchestratorState(state: OrchestratorState): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.orchestratorStatePath,
        JSON.stringify(state, null, 2),
        'utf-8'
      );
      this.logger.debug('Saved orchestrator state');
    } catch (error) {
      this.logger.error('Failed to save orchestrator state', error);
      throw error;
    }
  }

  async getOrchestratorState(): Promise<OrchestratorState | null> {
    try {
      if (!fs.existsSync(this.orchestratorStatePath)) {
        return null;
      }
      
      const content = await fs.promises.readFile(this.orchestratorStatePath, 'utf-8');
      const state = JSON.parse(content);
      
      if (state.startTime) {
        state.startTime = new Date(state.startTime);
      }
      
      return state;
    } catch (error) {
      this.logger.error('Failed to load orchestrator state', error);
      return null;
    }
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [this.stateDir, this.issueStatesPath];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }
    }
  }
}