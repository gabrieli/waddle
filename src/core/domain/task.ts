/**
 * Task type constants
 */
export const TaskType = {
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  REVIEW: 'review'
} as const;

export type TaskType = typeof TaskType[keyof typeof TaskType];

/**
 * Task status constants
 */
export const TaskStatus = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  FAILED: 'failed'
} as const;

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

/**
 * Core Task domain entity
 */
export interface Task {
  id?: number;
  user_story_id: number;
  parent_task_id?: number;
  type: TaskType;
  status: TaskStatus;
  summary?: string;
  metadata?: Record<string, any>;
  branch_name?: string;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

/**
 * Valid task types
 */
const VALID_TASK_TYPES = new Set(Object.values(TaskType));

/**
 * Valid task statuses
 */
const VALID_TASK_STATUSES = new Set(Object.values(TaskStatus));

/**
 * Check if a task type is valid
 */
export function isValidTaskType(type: any): type is TaskType {
  return typeof type === 'string' && VALID_TASK_TYPES.has(type as TaskType);
}

/**
 * Check if a task status is valid
 */
export function isValidTaskStatus(status: any): status is TaskStatus {
  return typeof status === 'string' && VALID_TASK_STATUSES.has(status as TaskStatus);
}

/**
 * Create a new Task
 */
export function createTask(params: {
  user_story_id: number;
  type: TaskType;
  parent_task_id?: number;
  summary?: string;
  metadata?: Record<string, any>;
  branch_name?: string;
}): Task {
  if (!isValidTaskType(params.type)) {
    throw new Error(`Invalid task type: ${params.type}`);
  }

  return {
    user_story_id: params.user_story_id,
    type: params.type,
    status: TaskStatus.NEW,
    parent_task_id: params.parent_task_id,
    summary: params.summary,
    metadata: params.metadata,
    branch_name: params.branch_name,
    created_at: new Date()
  };
}