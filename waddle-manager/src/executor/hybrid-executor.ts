/**
 * Hybrid executor that routes to headless or interactive based on role
 */

import { EventEmitter } from 'events';
import { HeadlessClaudeExecutor } from './headless-claude';
import { InteractiveClaudeExecutor } from './interactive-claude';
import type { ExecutionRequest, ExecutionResult } from '../types';
import type { ClaudeExecutorConfig } from './types';

export interface HybridExecutorConfig {
  headlessConfig?: ClaudeExecutorConfig;
  interactiveConfig?: {
    claudePath?: string;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
}

export class HybridClaudeExecutor extends EventEmitter {
  private headlessExecutor: HeadlessClaudeExecutor;
  private interactiveExecutor: InteractiveClaudeExecutor;

  constructor(config: HybridExecutorConfig = {}) {
    super();
    
    // Initialize headless executor for architect/reviewer roles
    this.headlessExecutor = new HeadlessClaudeExecutor(config.headlessConfig);
    
    // Initialize interactive executor for developer role
    this.interactiveExecutor = new InteractiveClaudeExecutor(config.interactiveConfig);
    
    // Forward events from both executors
    this.setupEventForwarding();
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.emit('execution:start', {
      taskId: request.task.id,
      role: request.role,
      mode: request.role === 'developer' ? 'interactive' : 'headless',
    });

    try {
      // Route based on role
      if (request.role === 'developer') {
        // Developers need interactive mode for iteration
        const result = await this.interactiveExecutor.execute(request);
        
        this.emit('execution:complete', {
          taskId: request.task.id,
          role: request.role,
          mode: 'interactive',
          success: result.success,
        });
        
        return result;
      } else {
        // Architects and reviewers can use headless mode
        const result = await this.headlessExecutor.execute(request);
        
        this.emit('execution:complete', {
          taskId: request.task.id,
          role: request.role,
          mode: 'headless',
          success: result.success,
        });
        
        return result;
      }
    } catch (error) {
      this.emit('execution:error', {
        taskId: request.task.id,
        role: request.role,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  private setupEventForwarding(): void {
    // Forward events from headless executor
    this.headlessExecutor.on('attempt', (data) => {
      this.emit('attempt', { ...data, mode: 'headless' });
    });
    
    this.headlessExecutor.on('error', (data) => {
      this.emit('error', { ...data, mode: 'headless' });
    });
    
    this.headlessExecutor.on('stdout', (data) => {
      this.emit('stdout', { ...data, mode: 'headless' });
    });
    
    this.headlessExecutor.on('stderr', (data) => {
      this.emit('stderr', { ...data, mode: 'headless' });
    });
    
    // Forward events from interactive executor
    this.interactiveExecutor.on('attempt', (data) => {
      this.emit('attempt', { ...data, mode: 'interactive' });
    });
    
    this.interactiveExecutor.on('error', (data) => {
      this.emit('error', { ...data, mode: 'interactive' });
    });
    
    this.interactiveExecutor.on('stdout', (data) => {
      this.emit('stdout', { ...data, mode: 'interactive' });
    });
    
    this.interactiveExecutor.on('stderr', (data) => {
      this.emit('stderr', { ...data, mode: 'interactive' });
    });
  }

  // Check availability of both executors
  async checkAvailability(): Promise<{
    headless: boolean;
    interactive: boolean;
  }> {
    const [headlessAvailable, interactiveAvailable] = await Promise.all([
      this.headlessExecutor.checkClaudeAvailable(),
      this.interactiveExecutor.checkClaudeAvailable(),
    ]);
    
    return {
      headless: headlessAvailable,
      interactive: interactiveAvailable,
    };
  }

  // Get config for both executors
  getConfig(): {
    headless: any;
    interactive: any;
  } {
    return {
      headless: this.headlessExecutor.getConfig(),
      interactive: this.interactiveExecutor,
    };
  }
}