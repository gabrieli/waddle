import { getDatabase } from './connection.js';
import { WorkItem, WorkHistory, WorkItemType, WorkItemStatus, HistoryAction } from '../types/index.js';

export function createWorkItem(
  id: string,
  type: WorkItemType,
  title: string,
  description: string | null = null,
  parentId: string | null = null,
  status: WorkItemStatus = 'backlog'
): WorkItem {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO work_items (id, type, parent_id, title, description, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, type, parentId, title, description, status);
  
  return getWorkItem(id)!;
}

export function getWorkItem(id: string): WorkItem | null {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM work_items WHERE id = ?
  `);
  
  return stmt.get(id) as WorkItem | null;
}

export function getAllWorkItems(): WorkItem[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM work_items
    ORDER BY created_at DESC
  `);
  
  return stmt.all() as WorkItem[];
}

export function getWorkItemsByStatus(status: WorkItemStatus): WorkItem[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM work_items
    WHERE status = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(status) as WorkItem[];
}

export function getChildWorkItems(parentId: string): WorkItem[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM work_items
    WHERE parent_id = ?
    ORDER BY created_at ASC
  `);
  
  return stmt.all(parentId) as WorkItem[];
}

export function updateWorkItemStatus(id: string, status: WorkItemStatus, role?: string): void {
  const db = getDatabase();
  
  db.transaction(() => {
    // Update work item
    const updateStmt = db.prepare(`
      UPDATE work_items
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(status, id);
    
    // Add history entry
    addHistory(id, 'status_change', JSON.stringify({ from: getWorkItem(id)?.status, to: status }), role || 'system');
  })();
}

export function addHistory(
  workItemId: string,
  action: HistoryAction,
  content: string | null,
  createdBy: string
): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO work_history (work_item_id, action, content, created_by)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(workItemId, action, content, createdBy);
}

export function getWorkItemHistory(workItemId: string): WorkHistory[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM work_history
    WHERE work_item_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(workItemId) as WorkHistory[];
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

// Work item locking functions

export function claimWorkItem(workItemId: string, agentId: string): boolean {
  const db = getDatabase();
  
  try {
    // Atomically claim the work item if it's not already being processed
    const result = db.prepare(`
      UPDATE work_items
      SET processing_started_at = CURRENT_TIMESTAMP,
          processing_agent_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND (processing_agent_id IS NULL 
             OR processing_started_at < datetime('now', '-30 minutes'))
    `).run(agentId, workItemId);
    
    if (result.changes > 0) {
      addHistory(workItemId, 'agent_output', `Work claimed by agent ${agentId}`, agentId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to claim work item:', error);
    return false;
  }
}

export function releaseWorkItem(workItemId: string, agentId: string): boolean {
  const db = getDatabase();
  
  try {
    // Only release if this agent owns the lock
    const result = db.prepare(`
      UPDATE work_items
      SET processing_started_at = NULL,
          processing_agent_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND processing_agent_id = ?
    `).run(workItemId, agentId);
    
    if (result.changes > 0) {
      addHistory(workItemId, 'agent_output', `Work released by agent ${agentId}`, agentId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to release work item:', error);
    return false;
  }
}

export function getAvailableWorkItems(): WorkItem[] {
  const db = getDatabase();
  
  // Get work items that are either not being processed or have stale locks
  const stmt = db.prepare(`
    SELECT * FROM work_items
    WHERE status NOT IN ('done')
      AND (processing_agent_id IS NULL 
           OR processing_started_at < datetime('now', '-30 minutes'))
    ORDER BY 
      CASE status 
        WHEN 'review' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'ready' THEN 3
        ELSE 4
      END,
      created_at ASC
  `);
  
  return stmt.all() as WorkItem[];
}

export function checkAndReleaseStaleWork(): number {
  const db = getDatabase();
  
  try {
    // Release work items that have been locked for more than 30 minutes
    const result = db.prepare(`
      UPDATE work_items
      SET processing_started_at = NULL,
          processing_agent_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE processing_agent_id IS NOT NULL
        AND processing_started_at < datetime('now', '-30 minutes')
    `).run();
    
    if (result.changes > 0) {
      console.log(`Released ${result.changes} stale work locks`);
    }
    
    return result.changes;
  } catch (error) {
    console.error('Failed to release stale work:', error);
    return 0;
  }
}

export function updateProcessingTimestamp(workItemId: string, agentId: string): boolean {
  const db = getDatabase();
  
  try {
    // Update the processing timestamp to keep the lock alive
    const result = db.prepare(`
      UPDATE work_items
      SET processing_started_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND processing_agent_id = ?
    `).run(workItemId, agentId);
    
    return result.changes > 0;
  } catch (error) {
    console.error('Failed to update processing timestamp:', error);
    return false;
  }
}

// Epic management functions

export function checkEpicStatus(epicId: string): { hasActiveStories: boolean; allStoriesDone: boolean } {
  const stories = getChildWorkItems(epicId);
  
  if (stories.length === 0) {
    return { hasActiveStories: false, allStoriesDone: false };
  }
  
  const hasActiveStories = stories.some(story => 
    story.status === 'ready' || story.status === 'in_progress' || story.status === 'review'
  );
  
  const allStoriesDone = stories.every(story => story.status === 'done');
  
  return { hasActiveStories, allStoriesDone };
}

export function updateEpicBasedOnStories(epicId: string, role: string = 'system'): void {
  const epic = getWorkItem(epicId);
  if (!epic || epic.type !== 'epic') return;
  
  const { hasActiveStories, allStoriesDone } = checkEpicStatus(epicId);
  
  if (allStoriesDone && epic.status !== 'done') {
    updateWorkItemStatus(epicId, 'done', role);
    console.log(`   ✅ Epic ${epicId} marked as done (all stories completed)`);
  } else if (hasActiveStories && epic.status !== 'in_progress') {
    updateWorkItemStatus(epicId, 'in_progress', role);
    console.log(`   📝 Epic ${epicId} moved to in_progress (has active stories)`);
  }
}