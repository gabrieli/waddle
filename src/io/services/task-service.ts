/**
 * Task Service Implementation
 */
import Database from 'better-sqlite3';
import type { TaskService } from '../http/routes/tasks.ts';

export function createTaskService(db: Database.Database): TaskService {
  return {
    async assignTaskToAgent(taskId: number, agentId: number) {
      // Check if task and agent exist
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
      
      if (!task) {
        throw new Error('Task not found');
      }
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      if (task.status !== 'new') {
        throw new Error('Task is not available for assignment');
      }
      
      // Update task status to in_progress and set started_at
      const updateTask = db.prepare(`
        UPDATE tasks 
        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      
      updateTask.run(taskId);
      
      return {
        success: true,
        taskId,
        agentId,
        status: 'in_progress'
      };
    },
    
    async completeTask(taskId: number, summary: string) {
      // Check if task exists
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      
      if (!task) {
        throw new Error('Task not found');
      }
      
      if (task.status !== 'in_progress') {
        throw new Error('Task is not in progress');
      }
      
      // Update task with completion data
      const updateTask = db.prepare(`
        UPDATE tasks 
        SET status = 'done', summary = ?, completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      
      updateTask.run(summary, taskId);
      
      return {
        success: true,
        taskId,
        summary
      };
    },
    
    async createNextTask(parentTaskId: number, type: string) {
      // Get parent task
      const parentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parentTaskId);
      
      if (!parentTask) {
        throw new Error('Parent task not found');
      }
      
      if (parentTask.status !== 'done') {
        throw new Error('Parent task must be completed before creating next task');
      }
      
      // Validate task type
      const validTypes = ['development', 'testing', 'review'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid task type: ${type}. Must be one of: ${validTypes.join(', ')}`);
      }
      
      // Create next task
      const insertTask = db.prepare(`
        INSERT INTO tasks (user_story_id, parent_task_id, type, status, created_at)
        VALUES (?, ?, ?, 'new', CURRENT_TIMESTAMP)
      `);
      
      const result = insertTask.run(parentTask.user_story_id, parentTaskId, type);
      
      return {
        success: true,
        taskId: result.lastInsertRowid as number,
        type,
        parentTaskId
      };
    }
  };
}