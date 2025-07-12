/**
 * Work Items API Routes
 */
import { Router } from 'express';

export interface WorkItemService {
  createWorkItem(params: {
    name: string;
    description: string;
    type: 'epic' | 'user_story' | 'bug';
    assigned_to: 'developer' | 'architect' | 'tester';
  }): Promise<{
    success: boolean;
    workItemId: number;
    name: string;
    type: string;
    assigned_to: string;
  }>;
}

export function createWorkItemsRouter(service: WorkItemService): Router {
  const router = Router();

  // Create work item
  router.post('/', async (req, res) => {
    try {
      const { name, description, type, assigned_to } = req.body;

      // Validate required fields
      if (!name || !description || !type || !assigned_to) {
        return res.status(400).json({
          success: false,
          error: 'name, description, type, and assigned_to are required'
        });
      }

      // Validate type
      const validTypes = ['epic', 'user_story', 'bug'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`
        });
      }

      // Validate assigned_to
      const validAssignees = ['developer', 'architect', 'tester'];
      if (!validAssignees.includes(assigned_to)) {
        return res.status(400).json({
          success: false,
          error: `Invalid assigned_to: ${assigned_to}. Must be one of: ${validAssignees.join(', ')}`
        });
      }

      const result = await service.createWorkItem({
        name,
        description,
        type,
        assigned_to
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