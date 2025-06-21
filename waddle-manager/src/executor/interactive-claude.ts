/**
 * Interactive Claude executor for developer tasks
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import type { ExecutionRequest, ExecutionResult } from '../types';
import type { WaddleManager } from '../orchestrator';

export interface InteractiveClaudeConfig {
  claudePath?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  mcpServerUrl?: string;
}

export class InteractiveClaudeExecutor extends EventEmitter {
  private config: Required<InteractiveClaudeConfig>;
  private manager?: WaddleManager;

  constructor(config: InteractiveClaudeConfig = {}) {
    super();
    
    this.config = {
      claudePath: config.claudePath || 'claude',
      timeout: config.timeout ?? 600000, // 10 minutes default for dev tasks
      maxRetries: config.maxRetries ?? 1, // Less retries for interactive mode
      retryDelay: config.retryDelay ?? 2000,
      mcpServerUrl: config.mcpServerUrl ?? 'http://localhost:5173',
    };
  }

  // Set the manager to listen for task completion events
  setManager(manager: WaddleManager): void {
    this.manager = manager;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.emit('attempt', { 
          taskId: request.task.id, 
          attempt,
          maxRetries: this.config.maxRetries,
        });

        const result = await this.spawnInteractiveClaude(request);
        
        return {
          success: true,
          output: result.output,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        this.emit('error', {
          taskId: request.task.id,
          attempt,
          error: errorMessage,
        });

        if (attempt >= this.config.maxRetries) {
          return {
            success: false,
            error: `Failed after ${attempt} attempts: ${errorMessage}`,
            duration: Date.now() - startTime,
          };
        }

        // Wait before retry
        await this.delay(this.config.retryDelay);
      }
    }

    // Should not reach here
    return {
      success: false,
      error: 'Unexpected error in retry loop',
      duration: Date.now() - startTime,
    };
  }

  private async spawnInteractiveClaude(request: ExecutionRequest): Promise<{ output: any }> {
    return new Promise((resolve, reject) => {
      const prompt = this.buildInteractivePrompt(request);
      
      // Spawn interactive Claude
      const child = spawn(this.config.claudePath, ['code', prompt], {
        shell: true,
        env: {
          ...process.env,
          // Ensure MCP server is available
          MCP_SERVER_URL: this.config.mcpServerUrl || 'http://localhost:5173',
        },
      });

      let outputBuffer = '';
      let errorBuffer = '';
      let completionDetected = false;
      let taskOutput: any = null;

      // Set timeout
      const timeout = setTimeout(() => {
        if (!completionDetected) {
          child.kill('SIGTERM');
          reject(new Error('Task timed out'));
        }
      }, this.config.timeout);

      // Monitor stdout for completion
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputBuffer += chunk;
        
        // Emit output for monitoring
        this.emit('stdout', { data: chunk });
        
        // Check for task completion marker
        if (chunk.includes('reportTaskCompletion')) {
          // Look for the completion result in output
          const completionMatch = chunk.match(/Task \d+ marked as (complete|failed)/);
          if (completionMatch) {
            completionDetected = true;
            const parsed = this.parseCompletionFromOutput(outputBuffer);
            if (parsed) {
              taskOutput = parsed;
            }
          }
        }
      });

      // Monitor stderr
      child.stderr?.on('data', (data: Buffer) => {
        errorBuffer += data.toString();
        this.emit('stderr', { data: data.toString() });
      });

      // Handle process exit
      child.on('exit', (code) => {
        clearTimeout(timeout);
        
        if (completionDetected && taskOutput) {
          resolve({ output: taskOutput });
        } else if (code === 0) {
          // Process exited cleanly but no completion detected
          reject(new Error('Claude exited without calling reportTaskCompletion'));
        } else {
          reject(new Error(`Claude exited with code ${code}: ${errorBuffer}`));
        }
      });

      // Handle process error
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Listen for task completion via manager events
      if (this.manager) {
        const completionHandler = (data: any) => {
          if (data.taskId === request.task.id) {
            taskOutput = data.output;
            completionDetected = true;
            
            // Give Claude a moment to clean up, then terminate
            setTimeout(() => {
              if (!child.killed) {
                child.kill('SIGTERM');
              }
            }, 1000);
          }
        };
        
        this.manager.once('task:completed', completionHandler);
        
        // Clean up listener if process exits without completion
        child.once('exit', () => {
          this.manager?.removeListener('task:completed', completionHandler);
        });
      }
    });
  }

  private buildInteractivePrompt(request: ExecutionRequest): string {
    const contextSummary = request.context
      .map(c => `${c.type}: ${c.content.substring(0, 200)}...`)
      .join('\n');

    return `You are working on task #${request.task.id} for a feature in Waddle.

TASK DETAILS:
- Feature: ${request.task.featureId}
- Role: ${request.role}
- Description: ${request.task.description}
- Attempts so far: ${request.task.attempts}

CONTEXT:
${contextSummary}

IMPORTANT INSTRUCTIONS:
1. Complete the task using all available tools
2. Follow TDD practices - write tests first
3. When finished, you MUST call the 'reportTaskCompletion' MCP tool
4. Include in your completion report:
   - filesCreated: List of new files
   - filesModified: List of modified files
   - testsAdded: List of test files
   - summary: Brief summary of what was done
   - details: Detailed explanation
   - errors: Any errors encountered
   - nextSteps: Suggestions for next tasks

The MCP server is available at: ${this.config.mcpServerUrl || 'http://localhost:5173'}

Please begin working on this task now.`;
  }

  private parseCompletionFromOutput(output: string): any {
    // Try to extract task output from the Claude output
    // This is a fallback in case we don't get the event
    try {
      const jsonMatch = output.match(/\{[\s\S]*"filesCreated"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Ignore parse errors
    }
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check if interactive Claude is available
  async checkClaudeAvailable(): Promise<boolean> {
    try {
      const child = spawn(this.config.claudePath, ['--version'], { shell: true });
      
      return new Promise(resolve => {
        child.on('exit', (code) => {
          resolve(code === 0);
        });
        
        child.on('error', () => {
          resolve(false);
        });
        
        // Timeout check
        setTimeout(() => {
          if (child.kill) {
            child.kill();
          }
          resolve(false);
        }, 5000);
      });
    } catch {
      return false;
    }
  }
}