/**
 * Types for Headless Claude Executor
 */

import type { Role, Task, Context } from '../types';

export interface ClaudeExecutorConfig {
  claudePath?: string;  // Path to claude executable, defaults to 'claude'
  defaultModel?: string;  // Default model to use
  roleModels?: Record<Role, string>;  // Model per role
  maxRetries?: number;  // Max retry attempts
  retryDelay?: number;  // Initial retry delay in ms
  timeout?: number;  // Execution timeout in ms
  mcpServerUrl?: string;  // MCP server URL for tool access
}

export interface ExecutorOptions {
  role: Role;
  task: Task;
  context: Context[];
  prompt?: string;  // Override prompt
  model?: string;  // Override model
  tools?: string[];  // Override tools
  timeout?: number;  // Override timeout
}

export interface ClaudeSpawnOptions {
  prompt: string;
  model?: string;
  tools?: string[];
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

export interface ClaudeOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  duration: number;
}

export interface ParsedOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  logs?: string[];
}

export interface RolePromptTemplate {
  system: string;
  tools: string[];
  outputFormat: 'json' | 'text' | 'markdown';
  parseOutput: (output: string) => ParsedOutput;
}

export interface RetryState {
  attempt: number;
  lastError?: Error;
  nextDelay: number;
}

// Specific output types for different roles
export interface ArchitectOutput {
  design: {
    overview: string;
    components: Array<{
      name: string;
      description: string;
      responsibilities: string[];
    }>;
    dataFlow: string;
    dependencies: string[];
  };
  implementation: {
    approach: string;
    phases: string[];
    risks: string[];
  };
}

export interface DeveloperOutput {
  filesCreated: string[];
  filesModified: string[];
  testsAdded: string[];
  implementation: {
    summary: string;
    details: string;
  };
}

export interface ReviewerOutput {
  approved: boolean;
  issues: Array<{
    severity: 'critical' | 'major' | 'minor';
    type: string;
    description: string;
    file?: string;
    line?: number;
  }>;
  suggestions: string[];
  summary: string;
}