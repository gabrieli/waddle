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

  // Get all agents (simplified - no work assignments)
  router.get('/', async (req, res) => {
    try {
      const agents = database.prepare(`
        SELECT 
          a.*,
          'idle' as status
        FROM agents a
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

  // Get available agents (all agents are always available now)
  router.get('/available', async (req, res) => {
    try {
      const agents = database.prepare(`
        SELECT a.* FROM agents a
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

  return router;
}