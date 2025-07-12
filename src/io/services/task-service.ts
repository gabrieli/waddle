/**
 * Task Service Implementation
 * 
 * Note: Tasks include branch_name field for git worktree management.
 * Worktree paths should be computed from branch_name as: ./worktrees/{branch_name}/
 * This enables concurrent work on different branches on the same machine.
 */
import Database from 'better-sqlite3';
import type { TaskService } from '../http/routes/tasks.ts';

export function createTaskService(db: Database.Database): TaskService {
  return {
    async assignTaskToAgent(taskId: number, agentId?: number) {
      // Check if task exists
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      
      if (!task) {
        throw new Error('Task not found');
      }
      
      if (task.status !== 'new') {
        throw new Error('Task is not available for assignment');
      }
      
      // Update task status to in_progress and set started_at
      // Ignore agents table - manual assignment just marks task as in progress
      const updateTask = db.prepare(`
        UPDATE tasks 
        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      
      updateTask.run(taskId);
      
      return {
        success: true,
        taskId,
        agentId: agentId || null,
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
    
    async createTask(params: {
      type: string;
      parent_task_id?: number;
      user_story_id?: number;
      branch_name?: string;
    }) {
      const { type, parent_task_id, user_story_id, branch_name } = params;
      
      // Validate task type
      const validTypes = ['development', 'testing', 'review'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid task type: ${type}. Must be one of: ${validTypes.join(', ')}`);
      }
      
      // If parent_task_id is provided, validate and inherit values
      let actualUserStoryId = user_story_id;
      let actualBranchName = branch_name;
      
      if (parent_task_id) {
        const parentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parent_task_id);
        
        if (!parentTask) {
          throw new Error('Parent task not found');
        }
        
        // If user_story_id not provided, inherit from parent
        if (!actualUserStoryId) {
          actualUserStoryId = parentTask.user_story_id;
        }
        
        // If branch_name not provided, inherit from parent
        if (!actualBranchName) {
          actualBranchName = parentTask.branch_name;
        }
      }
      
      // Validate that we have either user_story_id or parent_task_id
      if (!actualUserStoryId && !parent_task_id) {
        throw new Error('Either user_story_id or parent_task_id must be provided');
      }
      
      // Create the task
      const insertTask = db.prepare(`
        INSERT INTO tasks (user_story_id, parent_task_id, type, status, branch_name, created_at)
        VALUES (?, ?, ?, 'new', ?, CURRENT_TIMESTAMP)
      `);
      
      const result = insertTask.run(actualUserStoryId, parent_task_id || null, type, actualBranchName || null);
      
      return {
        success: true,
        taskId: result.lastInsertRowid as number,
        type,
        parentTaskId: parent_task_id,
        userStoryId: actualUserStoryId
      };
    }
  };
}