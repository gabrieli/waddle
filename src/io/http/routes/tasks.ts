/**
 * Tasks API Routes
 */
import { Router } from 'express';

export interface TaskService {
  assignTaskToAgent(taskId: number, agentId?: number): Promise<{
    success: boolean;
    taskId: number;
    agentId: number | null;
    status: string;
  }>;
  
  completeTask(taskId: number, summary: string): Promise<{
    success: boolean;
    taskId: number;
    summary: string;
  }>;
  
  createNextTask(parentTaskId: number, type: string): Promise<{
    success: boolean;
    taskId: number;
    type: string;
    parentTaskId: number;
  }>;
}

export function createTasksRouter(service: TaskService): Router {
  const router = Router();

  // Assign task to agent
  router.post('/:taskId/assign', async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { agentId } = req.body;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'taskId is required'
        });
      }

      const result = await service.assignTaskToAgent(taskId, agentId);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Complete task with summary
  router.post('/:taskId/complete', async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { summary } = req.body;

      if (!taskId || !summary) {
        return res.status(400).json({
          success: false,
          error: 'taskId and summary are required'
        });
      }

      const result = await service.completeTask(taskId, summary);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create next task
  router.post('/:taskId/create-next', async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { type } = req.body;

      if (!taskId || !type) {
        return res.status(400).json({
          success: false,
          error: 'taskId and type are required'
        });
      }

      const result = await service.createNextTask(taskId, type);
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