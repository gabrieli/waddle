import { DatabaseConnection } from '../database/connection';
import { Agent, WorkItem } from '../database/schema';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected type: string;
  protected db: DatabaseConnection;

  constructor(name: string, type: string, db: DatabaseConnection) {
    this.id = uuidv4();
    this.name = name;
    this.type = type;
    this.db = db;
  }

  protected registerAgent(workItemId?: string): void {
    const stmt = this.db.getDatabase().prepare(`
      INSERT INTO agents (id, name, type, work_item_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    stmt.run(this.id, this.name, this.type, workItemId || null);
  }

  protected updateAgentWorkItem(workItemId: string | null): void {
    const stmt = this.db.getDatabase().prepare(`
      UPDATE agents 
      SET work_item_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    stmt.run(workItemId, this.id);
  }

  protected lockWorkItem(workItemId: string): boolean {
    const db = this.db.getDatabase();
    
    // Check if work item exists and is not locked
    const checkStmt = db.prepare(`
      SELECT processing_agent_id 
      FROM work_items 
      WHERE id = ? AND (processing_agent_id IS NULL OR processing_agent_id = ?)
    `);
    
    const workItem = checkStmt.get(workItemId, this.id);
    
    if (!workItem) {
      return false;
    }
    
    // Lock the work item
    const lockStmt = db.prepare(`
      UPDATE work_items 
      SET processing_agent_id = ?, processing_started_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND (processing_agent_id IS NULL OR processing_agent_id = ?)
    `);
    
    const result = lockStmt.run(this.id, workItemId, this.id);
    return result.changes > 0;
  }

  protected unlockWorkItem(workItemId: string): void {
    const stmt = this.db.getDatabase().prepare(`
      UPDATE work_items 
      SET processing_agent_id = NULL, processing_started_at = NULL, updated_at = datetime('now')
      WHERE id = ? AND processing_agent_id = ?
    `);
    
    stmt.run(workItemId, this.id);
  }

  protected updateWorkItemStatus(workItemId: string, status: WorkItem['status'], assignedRole?: WorkItem['assigned_role']): void {
    const stmt = this.db.getDatabase().prepare(`
      UPDATE work_items 
      SET status = ?, assigned_role = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    stmt.run(status, assignedRole || null, workItemId);
  }

  protected addWorkHistory(workItemId: string, action: string, details?: any): void {
    const stmt = this.db.getDatabase().prepare(`
      INSERT INTO work_history (id, work_item_id, action, agent_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(uuidv4(), workItemId, action, this.id, JSON.stringify(details || {}));
  }

  abstract execute(workItemId: string): Promise<void>;
}