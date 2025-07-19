/**
 * Agents API Routes
 */
import { Router } from 'express';
import Database from 'better-sqlite3';

export interface Agent {
  id: number;
  type: 'developer' | 'architect' | 'tester' | 'reviewer';
  status: 'idle' | 'working';
  current_task_id?: number;
  current_task_type?: string;
}

/**
 * Factory function to create agents router
 */
export function createAgentsRouter(database: Database.Database): Router {
  const router = Router();

  // Get all agents with their current status
  router.get('/', async (req, res) => {
    try {
      const agents = database.prepare(`
        SELECT 
          a.*,
          wi.id as current_work_item_id,
          wi.name as current_work_item_name,
          wi.type as current_work_item_type,
          CASE 
            WHEN a.work_item_id IS NOT NULL THEN 'working'
            ELSE 'idle'
          END as status
        FROM agents a
        LEFT JOIN work_items wi ON a.work_item_id = wi.id
        ORDER BY a.type
      `).all();
      
      res.json({
        success: true,
        agents: agents
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get available agents
  router.get('/available', async (req, res) => {
    try {
      const agents = database.prepare(`
        SELECT a.* FROM agents a
        WHERE a.work_item_id IS NULL
      `).all();
      
      res.json({
        success: true,
        agents: agents
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