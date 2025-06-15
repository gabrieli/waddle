import * as fs from 'fs';
import * as path from 'path';

export interface WaddleConfig {
  orchestrator?: {
    checkIntervalMs?: number;
    maxConcurrentTasks?: number;
    taskTimeoutMs?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
  };
  github?: {
    defaultLabels?: string[];
  };
  stateDir?: string;
}

export class Config {
  private config: WaddleConfig = {};
  private configPath: string;
  private stateDir: string;

  constructor(private workingDir: string) {
    this.configPath = path.join(workingDir, 'waddle.config.json');
    this.stateDir = path.join(workingDir, '.waddle');
  }

  async load(): Promise<void> {
    if (fs.existsSync(this.configPath)) {
      const content = await fs.promises.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(content);
    } else {
      this.config = this.getDefaultConfig();
      await this.save();
    }

    if (this.config.stateDir) {
      this.stateDir = path.resolve(this.workingDir, this.config.stateDir);
    }

    await this.ensureStateDir();
  }

  async save(): Promise<void> {
    await fs.promises.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );
  }

  get<K extends keyof WaddleConfig>(key: K): WaddleConfig[K] {
    return this.config[key];
  }

  set<K extends keyof WaddleConfig>(key: K, value: WaddleConfig[K]): void {
    this.config[key] = value;
  }

  getStateDir(): string {
    return this.stateDir;
  }

  private getDefaultConfig(): WaddleConfig {
    return {
      orchestrator: {
        checkIntervalMs: 30000,
        maxConcurrentTasks: 1,
        taskTimeoutMs: 3600000,
        retryAttempts: 3,
        retryDelayMs: 60000
      },
      github: {
        defaultLabels: ['waddle']
      }
    };
  }

  private async ensureStateDir(): Promise<void> {
    if (!fs.existsSync(this.stateDir)) {
      await fs.promises.mkdir(this.stateDir, { recursive: true });
    }
  }
}