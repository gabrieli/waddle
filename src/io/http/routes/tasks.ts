/**
 * Tasks API Routes
 */
import { Router } from 'express';
import Database from 'better-sqlite3';
import { processDevelopmentTask } from '../../processors/development-processor.ts';
import { processTestingTask } from '../../processors/testing-processor.ts';
import { processReviewTask } from '../../processors/review-processor.ts';

/**
 * Check if a task can be started (not running for less than 15 minutes)
 */
function canStartTask(task: any): boolean {
  if (!task.started_at) {
    return true;
  }
  
  // Check if task started more than 15 minutes ago
  const startedAt = new Date(task.started_at);
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  
  return startedAt < fifteenMinutesAgo;
}

/**
 * Log task start
 */
function logTaskStart(taskId: number, taskType: string, workItemId: number): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 Task ${taskId} (${taskType}) starting for work item ${workItemId}`);
}

/**
 * Log task completion
 */
function logTaskCompletion(taskId: number, taskType: string, workItemId: number, success: boolean, summary?: string): void {
  const timestamp = new Date().toISOString();
  const status = success ? '✅' : '❌';
  console.log(`[${timestamp}] ${status} Task ${taskId} (${taskType}) ${success ? 'completed' : 'failed'} for work item ${workItemId}`);
  
  if (summary) {
    console.log(`[${timestamp}] 📝 Task ${taskId} summary:`);
    // Indent each line of the summary
    summary.split('\n').forEach(line => {
      console.log(`[${timestamp}]    ${line}`);
    });
  }
}

/**
 * Process task in background
 */
async function processTaskInBackground(taskId: number, taskType: string, database: Database.Database): Promise<void> {
  try {
    let result;
    
    switch (taskType) {
      case 'development':
        result = await processDevelopmentTask(taskId, database);
        break;
      case 'testing':
        result = await processTestingTask(taskId, database);
        break;
      case 'review':
        result = await processReviewTask(taskId, database);
        break;
      default:
        result = { 
          success: false, 
          error: `Unknown task type: ${taskType}` 
        };
    }

    // Get task details for logging
    const task = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    
    if (result.success) {
      logTaskCompletion(taskId, taskType, task.user_story_id, true, result.summary);
    } else {
      // Mark task as failed
      database.prepare(`
        UPDATE tasks 
        SET status = 'failed', summary = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(result.error || 'Task processing failed', taskId);
      
      logTaskCompletion(taskId, taskType, task.user_story_id, false, result.error);
    }
  } catch (error) {
    // Handle unexpected errors
    const task = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    const errorMessage = error.message || 'Unexpected error during task processing';
    
    database.prepare(`
      UPDATE tasks 
      SET status = 'failed', summary = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(errorMessage, taskId);
    
    logTaskCompletion(taskId, task?.type || 'unknown', task?.user_story_id || 0, false, errorMessage);
  }
}

export interface TaskService {
  createTask(params: {
    type: string;
    parent_task_id?: number;
    work_item_id: number;
    branch_name?: string;
  }): Promise<{
    success: boolean;
    taskId: number;
    type: string;
    parentTaskId?: number;
    workItemId: number;
  }>;
}

export interface TasksRouterOptions {
  service: TaskService;
  database: Database.Database;
}

export function createTasksRouter(options: TasksRouterOptions): Router {
  const { service, database } = options;
  const router = Router();

  // Process task
  router.post('/:taskId/process', async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { wait = false } = req.body;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'taskId is required'
        });
      }

      // Get task to determine type and check status
      const task = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      // Check if task can be started (15-minute lock)
      if (task.status === 'in_progress' && !canStartTask(task)) {
        return res.json({
          success: true,
          status: 'in_progress',
          message: 'Task already running'
        });
      }

      // Only allow processing of 'new', 'failed' tasks, or tasks that have been running for >15 minutes
      if (task.status !== 'new' && task.status !== 'failed' && !canStartTask(task)) {
        return res.status(400).json({
          success: false,
          error: `Cannot process task with status '${task.status}'`
        });
      }

      // If wait is true, just set wait flag and return
      if (wait) {
        database.prepare('UPDATE tasks SET wait = TRUE WHERE id = ?').run(taskId);
        return res.json({
          success: true,
          message: 'Task queued for processing'
        });
      }

      // Mark task as in_progress and set started_at
      database.prepare(`
        UPDATE tasks 
        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(taskId);

      // Log task start
      logTaskStart(taskId, task.type, task.user_story_id);

      // Start background processing (don't await)
      processTaskInBackground(taskId, task.type, database).catch(error => {
        console.error(`[${new Date().toISOString()}] ❌ Background processing error for task ${taskId}:`, error);
      });

      // Return immediately
      res.json({
        success: true,
        status: 'in_progress',
        message: 'Task processing started'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create task (generic)
  router.post('/', async (req, res) => {
    try {
      const { type, parent_task_id, user_story_id, work_item_id, branch_name } = req.body;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'type is required'
        });
      }

      // Validate task type
      const validTypes = ['development', 'testing', 'review'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid task type: ${type}. Valid types are: ${validTypes.join(', ')}`
        });
      }

      // Either user_story_id or parent_task_id must be provided
      const effectiveWorkItemId = work_item_id || user_story_id;
      if (!effectiveWorkItemId && !parent_task_id) {
        return res.status(400).json({
          success: false,
          error: 'Either user_story_id or parent_task_id must be provided'
        });
      }

      // If parent_task_id is provided, get the work_item_id from parent task
      let finalWorkItemId = effectiveWorkItemId;
      if (parent_task_id && !finalWorkItemId) {
        const parentTask = database.prepare('SELECT user_story_id, branch_name FROM tasks WHERE id = ?').get(parent_task_id);
        if (!parentTask) {
          return res.status(400).json({
            success: false,
            error: 'Parent task not found'
          });
        }
        finalWorkItemId = parentTask.user_story_id;
      }

      const result = await service.createTask({
        type,
        parent_task_id,
        work_item_id: finalWorkItemId,
        branch_name
      });
      
      // Transform response to match expected format
      const response = {
        success: result.success,
        taskId: result.taskId,
        type: result.type,
        userStoryId: result.workItemId,
        parentTaskId: result.parentTaskId
      };
      
      res.json(response);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all tasks
  router.get('/', async (req, res) => {
    try {
      const tasks = database.prepare(`
        SELECT t.*, wi.name as work_item_name, wi.type as work_item_type
        FROM tasks t
        LEFT JOIN work_items wi ON t.user_story_id = wi.id
        ORDER BY t.created_at DESC
      `).all();
      
      res.json({
        success: true,
        tasks: tasks
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}