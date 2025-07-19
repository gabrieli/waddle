/**
 * Work Item Service Implementation
 */
import Database from 'better-sqlite3';
import type { WorkItemService } from '../http/routes/work-items-api.ts';
import { createTaskService } from './task-service.ts';

export function createWorkItemService(db: Database.Database): WorkItemService {
  const taskService = createTaskService(db);
  
  return {
    async createWorkItem(params: {
      name: string;
      description: string;
      type: 'epic' | 'user_story' | 'bug';
      assigned_to: 'developer' | 'architect' | 'tester';
    }) {
      const { name, description, type, assigned_to } = params;
      
      // Create the work item
      const insertWorkItem = db.prepare(`
        INSERT INTO work_items (name, description, type, assigned_to, status, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'new', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      const result = insertWorkItem.run(name, description, type, assigned_to);
      const workItemId = result.lastInsertRowid as number;
      
      // Determine task type based on assigned_to
      let taskType: string;
      switch (assigned_to) {
        case 'developer':
          taskType = 'development';
          break;
        case 'architect':
          taskType = 'development'; // architects create development tasks
          break;
        case 'tester':
          taskType = 'testing';
          break;
      }
      
      // Create the task automatically
      await taskService.createTask({
        type: taskType,
        work_item_id: workItemId
      });
      
      return {
        success: true,
        workItemId,
        name,
        type,
        assigned_to
      };
    },

    async getAllWorkItems() {
      const workItems = db.prepare(`
        SELECT * FROM work_items 
        ORDER BY created_at DESC
      `).all();
      
      return {
        success: true,
        workItems
      };
    }
  };
}