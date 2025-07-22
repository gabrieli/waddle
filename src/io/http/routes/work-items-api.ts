/**
 * Work Items API Routes
 */
import { Router } from 'express';

export interface WorkItemService {
  createWorkItem(params: {
    name: string;
    description: string;
    type: 'epic' | 'user_story' | 'bug';
    assigned_to: 'developer' | 'architect' | 'tester' | 'reviewer';
    branch_name?: string;
    create_new_branch?: boolean;
    custom_branch_name?: string;
  }): Promise<{
    success: boolean;
    workItemId: number;
    name: string;
    type: string;
    assigned_to: string;
    branch_name?: string;
  }>;
  
  getAllWorkItems(): Promise<{
    success: boolean;
    workItems: Array<{
      id: number;
      name: string;
      description: string;
      type: string;
      status: string;
      assigned_to: string;
      created_at: string;
      updated_at: string;
    }>;
  }>;

  deleteWorkItem(id: number): Promise<{
    success: boolean;
    message: string;
    deletedTasks?: number;
  }>;
}

export function createWorkItemsRouter(service: WorkItemService): Router {
  const router = Router();

  // Create work item
  router.post('/', async (req, res) => {
    try {
      const { name, description, type, assigned_to, branch_name, create_new_branch, custom_branch_name } = req.body;

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
      const validAssignees = ['developer', 'architect', 'tester', 'reviewer'];
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
        assigned_to,
        branch_name,
        create_new_branch,
        custom_branch_name
      });
      
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all work items
  router.get('/', async (req, res) => {
    try {
      const result = await service.getAllWorkItems();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete work item
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Validate ID
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid work item ID. Must be a positive integer.'
        });
      }

      const result = await service.deleteWorkItem(id);
      
      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}