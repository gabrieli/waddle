/**
 * Agent Repository - Database access layer for agents
 */

import { getDatabase } from '../db/index.ts';
import Database from 'better-sqlite3';

export interface AgentRepository {
  clearAll(): Promise<number>;
  create(type: 'developer' | 'architect' | 'tester'): Promise<number>;
  clearWorkItemAssignments(): Promise<number>;
}

/**
 * SQLite implementation of Agent Repository
 */
export class SqliteAgentRepository implements AgentRepository {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database || getDatabase();
  }

  async clearAll(): Promise<number> {
    const result = this.db.prepare('DELETE FROM agents').run();
    return result.changes;
  }

  async create(type: 'developer' | 'architect' | 'tester'): Promise<number> {
    if (!['developer', 'architect', 'tester'].includes(type)) {
      throw new Error(`Invalid agent type: ${type}`);
    }

    const stmt = this.db.prepare(`
      INSERT INTO agents (type, version) 
      VALUES (?, 1)
    `);
    
    const result = stmt.run(type);
    return result.lastInsertRowid as number;
  }

  async clearWorkItemAssignments(): Promise<number> {
    const stmt = this.db.prepare(`
      UPDATE work_items 
      SET agent_id = NULL, started_at = NULL 
      WHERE agent_id IS NOT NULL OR started_at IS NOT NULL
    `);
    
    const result = stmt.run();
    return result.changes;
  }
}

/**
 * Factory function to create agent repository
 */
export function createAgentRepository(database?: Database.Database): AgentRepository {
  return new SqliteAgentRepository(database);
}