/**
 * Work Item Service Implementation
 */
import Database from 'better-sqlite3';
import type { WorkItemService } from '../http/routes/work-items-api.ts';

export function createWorkItemService(db: Database.Database): WorkItemService {
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
      
      return {
        success: true,
        workItemId: result.lastInsertRowid as number,
        name,
        type,
        assigned_to
      };
    }
  };
}