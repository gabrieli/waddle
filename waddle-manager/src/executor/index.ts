/**
 * Headless Claude executor
 */

import type { ExecutionRequest, ExecutionResult } from '../types';

export class HeadlessClaudeExecutor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    console.log(`🤖 Executing task for role: ${request.role}`);
    
    return {
      success: true,
      output: {},
      duration: 0,
    };
  }
}