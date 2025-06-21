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