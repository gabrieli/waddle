/**
 * Tasks API Routes
 */
import { Router } from 'express';
import Database from 'better-sqlite3';
import { processDevelopmentTask } from '../../processors/development-processor.ts';

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
          // TODO: Implement testing processor
          result = { 
            success: false, 
            error: 'Testing processor not implemented yet' 
          };
          break;
        case 'review':
          // TODO: Implement review processor
          result = { 
            success: false, 
            error: 'Review processor not implemented yet' 
          };
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
      const { type, parent_task_id, work_item_id, branch_name } = req.body;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'type is required'
        });
      }

      if (!work_item_id) {
        return res.status(400).json({
          success: false,
          error: 'work_item_id is required'
        });
      }

      const result = await service.createTask({
        type,
        parent_task_id,
        work_item_id,
        branch_name
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}