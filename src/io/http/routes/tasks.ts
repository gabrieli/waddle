/**
 * Tasks API Routes
 */
import { Router } from 'express';
import Database from 'better-sqlite3';
import { processDevelopmentTask } from '../../processors/development-processor.ts';
import { processTestingTask } from '../../processors/testing-processor.ts';
import { processReviewTask } from '../../processors/review-processor.ts';

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
    // Set 10-minute timeout for task processing
    req.setTimeout(600000); // 10 minutes in milliseconds
    res.setTimeout(600000);
    
    try {
      const taskId = parseInt(req.params.taskId);
      const { wait = false } = req.body;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'taskId is required'
        });
      }

      // Get task to determine type
      const task = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
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

      // Process immediately based on task type
      let result;
      switch (task.type) {
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
            error: `Unknown task type: ${task.type}` 
          };
      }

      res.json(result);
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

  return router;
}