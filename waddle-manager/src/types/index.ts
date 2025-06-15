/**
 * Core type definitions for Waddle
 */

export type FeatureStatus = 'pending' | 'in_progress' | 'complete' | 'failed';
export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'failed';
export type Priority = 'low' | 'normal' | 'high' | 'critical';
export type Role = 'architect' | 'developer' | 'reviewer';
export type Actor = 'system' | 'user' | 'ai';

export interface Feature {
  id: string;
  description: string;
  status: FeatureStatus;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: number;
  featureId: string;
  role: Role;
  description: string;
  status: TaskStatus;
  attempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  output?: unknown;
  error?: string;
}

export interface Transition {
  id: number;
  entityType: 'feature' | 'task';
  entityId: string;
  fromState?: string;
  toState: string;
  reason?: string;
  actor: Actor;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Context {
  id: number;
  featureId: string;
  type: 'architecture' | 'review' | 'implementation';
  content: string;
  author?: string;
  createdAt: Date;
}

export interface AuditEntry {
  id: number;
  action: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface ExecutionRequest {
  task: Task;
  role: Role;
  context: Context[];
  timeout?: number;
}

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
}

export interface ProgressReport {
  active: TaskProgress[];
  pending: number;
  completed: number;
  avgCompletionTime: number;
}

export interface TaskProgress {
  taskId: number;
  featureId: string;
  description: string;
  progress: number;
  startedAt: Date;
  estimatedCompletion?: Date;
}

export interface WaddleConfig {
  manager: {
    port: number;
    webUIPort: number;
    databasePath: string;
    logLevel: string;
  };
  orchestrator: {
    checkInterval: number;
    maxConcurrentTasks: number;
    taskTimeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  executor: {
    claudePath: string;
    defaultModel: string;
    roleModels: Record<Role, string>;
  };
  tools: Record<Role, string[]>;
}