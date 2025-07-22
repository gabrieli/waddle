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
      branch_name?: string;
      create_new_branch?: boolean;
      custom_branch_name?: string;
    }) {
      const { name, description, type, assigned_to, branch_name, create_new_branch, custom_branch_name } = params;
      
      // Create the work item first to get ID
      const insertWorkItem = db.prepare(`
        INSERT INTO work_items (name, description, type, assigned_to, status, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'new', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      const result = insertWorkItem.run(name, description, type, assigned_to);
      const workItemId = result.lastInsertRowid as number;
      
      // Determine branch name based on user selection
      let finalBranchName: string;
      
      if (create_new_branch || !branch_name) {
        if (custom_branch_name) {
          // Process custom branch name from frontend for NEW branch creation
          if (custom_branch_name.startsWith('feature/work-item-')) {
            // Already follows the work-item pattern, use as-is
            finalBranchName = custom_branch_name;
          } else if (custom_branch_name.startsWith('feature/')) {
            // Clean branch name from frontend - convert to work-item format for new branches
            const slug = custom_branch_name.replace('feature/', '');
            finalBranchName = generateBranchName(workItemId, slug);
          } else {
            // Raw slug provided - generate proper branch name for new branches
            const slug = custom_branch_name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
            finalBranchName = generateBranchName(workItemId, slug);
          }
        } else {
          // Generate new branch name from work item name
          const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
          finalBranchName = generateBranchName(workItemId, slug);
        }
      } else {
        // Use existing branch selected by user - allow any branch name (main, develop, etc.)
        finalBranchName = branch_name;
      }
      
      const worktreePath = `./worktrees/${finalBranchName}/`;
      
      // Update work item with branch information
      const updateWorkItem = db.prepare(`
        UPDATE work_items 
        SET branch_name = ?, worktree_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      updateWorkItem.run(finalBranchName, worktreePath, workItemId);
      
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
        branch_name: finalBranchName
      });
      
      return {
        success: true,
        workItemId,
        name,
        type,
        assigned_to,
        branch_name: finalBranchName
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
    },

    async deleteWorkItem(id: number) {
      // Use transaction to ensure all deletions are atomic
      const transaction = db.transaction(() => {
        // First, check if the work item exists
        const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(id);
        if (!workItem) {
          return {
            success: false,
            message: `Work item with ID ${id} not found.`
          };
        }

        // Count associated tasks before deletion
        const taskCount = db.prepare(
          'SELECT COUNT(*) as count FROM tasks WHERE user_story_id = ?'
        ).get(id) as { count: number };

        // Delete associated tasks first (cascade deletion)
        const deleteTasksResult = db.prepare(
          'DELETE FROM tasks WHERE user_story_id = ?'
        ).run(id);

        // Delete state transitions for this work item
        const deleteTransitionsResult = db.prepare(
          'DELETE FROM state_transitions WHERE work_item_id = ?'
        ).run(id);

        // Check for child work items and handle them
        const childWorkItems = db.prepare(
          'SELECT id, name FROM work_items WHERE parent_id = ?'
        ).all(id);

        if (childWorkItems.length > 0) {
          // Set parent_id to null for child work items to avoid orphaning them
          const updateChildrenResult = db.prepare(
            'UPDATE work_items SET parent_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE parent_id = ?'
          ).run(id);
        }

        // Finally, delete the work item itself
        const deleteWorkItemResult = db.prepare(
          'DELETE FROM work_items WHERE id = ?'
        ).run(id);

        return {
          success: true,
          message: `Successfully deleted work item "${workItem.name}" and ${taskCount.count} associated tasks.`,
          deletedTasks: taskCount.count,
          orphanedChildren: childWorkItems.length
        };
      });

      try {
        return transaction();
      } catch (error) {
        return {
          success: false,
          message: `Failed to delete work item: ${error.message}`
        };
      }
    }
  };
}