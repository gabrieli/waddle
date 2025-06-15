/**
 * Headless Claude executor implementation
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import type {
  ClaudeExecutorConfig,
  ExecutorOptions,
  ClaudeSpawnOptions,
  ClaudeOutput,
  RetryState,
} from './types';
import type { ExecutionResult, ExecutionRequest } from '../types';
import { buildPrompt, getToolsForRole, parseRoleOutput } from './role-prompts';

export class HeadlessClaudeExecutor extends EventEmitter {
  private config: Required<ClaudeExecutorConfig>;

  constructor(config: ClaudeExecutorConfig = {}) {
    super();
    
    this.config = {
      claudePath: config.claudePath || 'claude',
      defaultModel: config.defaultModel || 'claude-3-sonnet-20240229',
      roleModels: {
        architect: 'claude-3-sonnet-20240229',
        developer: 'claude-3-sonnet-20240229',
        reviewer: 'claude-3-sonnet-20240229',
        ...config.roleModels,
      },
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 300000, // 5 minutes default
    };
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    // Convert ExecutionRequest to ExecutorOptions for internal use
    const options: ExecutorOptions = {
      role: request.role,
      task: request.task,
      context: request.context,
      timeout: request.timeout,
    };
    
    // Build prompt from template
    const prompt = options.prompt || buildPrompt(
      options.role,
      options.task.description,
      options.context.map(c => c.content),
    );

    // Get tools for role
    const tools = options.tools || getToolsForRole(options.role);
    
    // Get model for role
    const model = options.model || 
      this.config.roleModels[options.role] || 
      this.config.defaultModel;

    // Spawn options
    const spawnOptions: ClaudeSpawnOptions = {
      prompt,
      model,
      tools,
      timeout: options.timeout || this.config.timeout,
    };

    // Retry state
    const retryState: RetryState = {
      attempt: 0,
      nextDelay: this.config.retryDelay,
    };

    // Execute with retries
    while (retryState.attempt < this.config.maxRetries) {
      try {
        retryState.attempt++;
        this.emit('attempt', { 
          taskId: options.task.id, 
          attempt: retryState.attempt,
          maxRetries: this.config.maxRetries,
        });

        const output = await this.spawnClaude(spawnOptions);
        
        if (output.exitCode === 0) {
          // Parse output based on role
          const parsed = parseRoleOutput(options.role, output.stdout);
          
          if (parsed.success) {
            return {
              success: true,
              output: parsed.data,
              duration: Date.now() - startTime,
            };
          } else {
            // Parsing failed
            throw new Error(parsed.error || 'Failed to parse output');
          }
        } else {
          // Non-zero exit code
          throw new Error(`Claude exited with code ${output.exitCode}: ${output.stderr}`);
        }
      } catch (error) {
        retryState.lastError = error as Error;
        
        // Only emit error on final failure
        if (retryState.attempt < this.config.maxRetries) {
          this.emit('retry', {
            taskId: options.task.id,
            attempt: retryState.attempt,
            error: retryState.lastError,
          });
        }

        if (retryState.attempt >= this.config.maxRetries) {
          // Max retries reached
          return {
            success: false,
            error: `Failed after ${retryState.attempt} attempts: ${retryState.lastError.message}`,
            duration: Date.now() - startTime,
          };
        }

        // Wait before retry with exponential backoff
        await this.delay(retryState.nextDelay);
        retryState.nextDelay *= 2;
      }
    }

    // Should not reach here
    return {
      success: false,
      error: 'Unexpected error in retry loop',
      duration: Date.now() - startTime,
    };
  }

  private async spawnClaude(options: ClaudeSpawnOptions): Promise<ClaudeOutput> {
    const startTime = Date.now();
    
    return new Promise<ClaudeOutput>((resolve, reject) => {
      try {
        const args: string[] = [];
        
        // Add print flag for non-interactive mode
        args.push('--print');
        
        // Add model if specified
        if (options.model) {
          args.push('--model', options.model);
        }
        
        // Add allowed tools if specified
        if (options.tools && options.tools.length > 0) {
          args.push('--allowedTools', options.tools.join(' '));
        }
        
        // Add the prompt as the last argument
        args.push(options.prompt);
        
        // Spawn process
        const child = spawn(this.config.claudePath, args, {
          env: {
            ...process.env,
            ...options.env,
          },
        });

        // Handle spawn errors immediately
        child.on('error', (error: any) => {
          clearTimeout(timeout);
          
          if (error.code === 'ENOENT') {
            reject(new Error(`Claude executable not found at: ${this.config.claudePath}`));
          } else {
            reject(error);
          }
        });


        let stdout = '';
        let stderr = '';
        let killed = false;

        // Set timeout
        const timeout = setTimeout(() => {
          killed = true;
          child.kill('SIGTERM');
          
          // Force kill after 5 seconds
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);
        }, options.timeout || this.config.timeout);

        // Collect stdout
        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
          this.emit('stdout', { data: data.toString() });
        });

        // Collect stderr
        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
          this.emit('stderr', { data: data.toString() });
        });

        // Handle process exit
        child.on('exit', (code, signal) => {
          clearTimeout(timeout);
          
          if (killed) {
            reject(new Error('Process timed out'));
            return;
          }

          resolve({
            stdout,
            stderr,
            exitCode: code,
            signal,
            duration: Date.now() - startTime,
          });
        });
      } catch (error: any) {
        // Handle synchronous spawn errors
        if (error.code === 'ENOENT') {
          reject(new Error(`Claude executable not found at: ${this.config.claudePath}`));
        } else {
          reject(error);
        }
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper method to check if Claude is available
  async checkClaudeAvailable(): Promise<boolean> {
    try {
      const output = await this.spawnClaude({
        prompt: 'Say "ok"',
        timeout: 5000,
      });
      return output.exitCode === 0;
    } catch {
      return false;
    }
  }

  // Update configuration
  updateConfig(config: Partial<ClaudeExecutorConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): Required<ClaudeExecutorConfig> {
    return { ...this.config };
  }
}