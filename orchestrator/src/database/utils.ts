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
  // Priority: bugs > stories > epics (within each status level)
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
      CASE type
        WHEN 'bug' THEN 1
        WHEN 'story' THEN 2
        WHEN 'task' THEN 3
        WHEN 'epic' THEN 4
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

// Error detection functions

export function getRecentErrors(hoursBack: number = 24): Array<{workItemId: string; error: any; history: WorkHistory}> {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM work_history
    WHERE action = 'error'
      AND created_at > datetime('now', '-${hoursBack} hours')
    ORDER BY created_at DESC
  `);
  
  const errors = stmt.all() as WorkHistory[];
  
  return errors.map(h => ({
    workItemId: h.work_item_id,
    error: JSON.parse(h.content || '{}'),
    history: h
  }));
}

export function hasUnresolvedError(workItemId: string): boolean {
  const db = getDatabase();
  
  // Check if there's an error without a subsequent fix
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM work_history h1
    WHERE h1.work_item_id = ?
      AND h1.action = 'error'
      AND NOT EXISTS (
        SELECT 1 FROM work_history h2
        WHERE h2.work_item_id = h1.work_item_id
          AND h2.action = 'agent_output'
          AND h2.created_at > h1.created_at
          AND h2.content LIKE '%error resolved%'
      )
  `);
  
  const result = stmt.get(workItemId) as { count: number };
  return result.count > 0;
}

// Bug metadata functions

export interface BugMetadata {
  work_item_id: string;
  reproduction_test: string | null;
  root_cause: string | null;
  reproduction_steps: string | null;
  temporary_artifacts: string | null;
  suggested_fix: string | null;
  created_at: string;
  updated_at: string;
}

export function saveBugMetadata(
  workItemId: string,
  reproductionTest: string,
  rootCause: string,
  reproductionSteps: string[],
  temporaryArtifacts: string[],
  suggestedFix?: string
): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO bug_metadata 
    (work_item_id, reproduction_test, root_cause, reproduction_steps, temporary_artifacts, suggested_fix, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  
  stmt.run(
    workItemId,
    reproductionTest,
    rootCause,
    JSON.stringify(reproductionSteps),
    JSON.stringify(temporaryArtifacts),
    suggestedFix || null
  );
}

export function getBugMetadata(workItemId: string): BugMetadata | null {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM bug_metadata WHERE work_item_id = ?
  `);
  
  return stmt.get(workItemId) as BugMetadata | null;
}