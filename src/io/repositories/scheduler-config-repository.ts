/**
 * Scheduler Configuration Repository
 */
import Database from 'better-sqlite3';
import { getDatabase } from '../db/database.ts';

export interface SchedulerConfig {
  id: number;
  isRunning: boolean;
  intervalSeconds: number;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerConfigRepository {
  get(): SchedulerConfig;
  setRunning(isRunning: boolean): void;
  updateLastRun(): void;
}

/**
 * Factory function to create scheduler config repository
 */
export function createSchedulerConfigRepository(database?: Database.Database): SchedulerConfigRepository {
  const db = database || getDatabase();
  
  const get = (): SchedulerConfig => {
    const row = db.prepare(`
      SELECT 
        id,
        is_running as isRunning,
        interval_seconds as intervalSeconds,
        last_run_at as lastRunAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM scheduler_config 
      WHERE id = 1
    `).get() as any;
    
    return {
      id: row.id,
      isRunning: Boolean(row.isRunning),
      intervalSeconds: row.intervalSeconds,
      lastRunAt: row.lastRunAt ? new Date(row.lastRunAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  };
  
  const setRunning = (isRunning: boolean): void => {
    db.prepare(`
      UPDATE scheduler_config 
      SET is_running = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `).run(isRunning ? 1 : 0);
  };
  
  const updateLastRun = (): void => {
    db.prepare(`
      UPDATE scheduler_config 
      SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `).run();
  };
  
  return {
    get,
    setRunning,
    updateLastRun
  };
}