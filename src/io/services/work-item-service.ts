/**
 * Work Item Service Implementation
 */
import Database from 'better-sqlite3';
import type { WorkItemService } from '../http/routes/work-items-api.ts';
import { createTaskService } from './task-service.ts';
import { generateBranchName } from '../../core/domain/work-item.ts';

export function createWorkItemService(db: Database.Database): WorkItemService {
  const taskService = createTaskService(db);
  
  return {
    async createWorkItem(params: {
      name: string;
      description: string;
      type: 'epic' | 'user_story' | 'bug';
      assigned_to: 'developer' | 'architect' | 'tester' | 'reviewer';
    }) {
      const { name, description, type, assigned_to } = params;
      
      // Create the work item first to get ID
      const insertWorkItem = db.prepare(`
        INSERT INTO work_items (name, description, type, assigned_to, status, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'new', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      const result = insertWorkItem.run(name, description, type, assigned_to);
      const workItemId = result.lastInsertRowid as number;
      
      // Generate branch name and worktree path based on work item ID and name
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
      const branchName = generateBranchName(workItemId, slug);
      const worktreePath = `./worktrees/${branchName}/`;
      
      // Update work item with branch information
      const updateWorkItem = db.prepare(`
        UPDATE work_items 
        SET branch_name = ?, worktree_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      updateWorkItem.run(branchName, worktreePath, workItemId);
      
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
        case 'reviewer':
          taskType = 'review';
          break;
        default:
          taskType = 'development'; // fallback
      }
      
      // Create the task automatically with branch information
      await taskService.createTask({
        type: taskType,
        work_item_id: workItemId,
        branch_name: branchName
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