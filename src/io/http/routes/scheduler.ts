/**
 * Scheduler Control API Routes
 */
import { Router } from 'express';
import Database from 'better-sqlite3';

export interface SchedulerStatus {
  isRunning: boolean;
  intervalSeconds: number;
  lastRunAt: Date | null;
}

export interface SchedulerControllers {
  startScheduler: () => boolean;
  stopScheduler: () => boolean;
}

/**
 * Factory function to create scheduler control router
 */
export function createSchedulerRouter(database: Database.Database, controllers?: SchedulerControllers): Router {
  const router = Router();

  // Get scheduler status
  router.get('/status', async (req, res) => {
    try {
      const config = database.prepare('SELECT * FROM scheduler_config WHERE id = 1').get() as any;
      
      if (!config) {
        return res.json({
          success: true,
          status: {
            isRunning: false,
            intervalSeconds: 30,
            lastRunAt: null
          }
        });
      }

      res.json({
        success: true,
        status: {
          isRunning: config.is_running === 1,
          intervalSeconds: config.interval_seconds,
          lastRunAt: config.last_run_at ? new Date(config.last_run_at) : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Start scheduler
  router.post('/start', async (req, res) => {
    try {
      if (controllers?.startScheduler) {
        const started = controllers.startScheduler();
        if (started) {
          database.prepare('UPDATE scheduler_config SET is_running = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
          res.json({
            success: true,
            message: 'Scheduler started'
          });
        } else {
          res.json({
            success: true,
            message: 'Scheduler already running'
          });
        }
      } else {
        // Fallback: just update database
        database.prepare(`
          INSERT OR REPLACE INTO scheduler_config (id, is_running, interval_seconds, last_run_at)
          VALUES (1, 1, COALESCE((SELECT interval_seconds FROM scheduler_config WHERE id = 1), 30), CURRENT_TIMESTAMP)
        `).run();
        
        res.json({
          success: true,
          message: 'Scheduler started'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Stop scheduler
  router.post('/stop', async (req, res) => {
    try {
      if (controllers?.stopScheduler) {
        const stopped = controllers.stopScheduler();
        if (stopped) {
          database.prepare('UPDATE scheduler_config SET is_running = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
          res.json({
            success: true,
            message: 'Scheduler stopped'
          });
        } else {
          res.json({
            success: true,
            message: 'Scheduler not running'
          });
        }
      } else {
        // Fallback: just update database
        database.prepare(`
          UPDATE scheduler_config 
          SET is_running = 0
          WHERE id = 1
        `).run();
        
        res.json({
          success: true,
          message: 'Scheduler stopped'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}