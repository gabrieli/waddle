/**
 * Agent Repository - Database access layer for agents
 * Following functional programming principles
 */

import { getDatabase } from '../db/index.ts';
import Database from 'better-sqlite3';

export interface AgentRepository {
  clearAll(): Promise<number>;
  create(type: 'developer' | 'architect' | 'tester'): Promise<number>;
  clearWorkItemAssignments(): Promise<number>;
}

// Pure validation function
export function isValidAgentType(type: string): type is 'developer' | 'architect' | 'tester' {
  return ['developer', 'architect', 'tester'].includes(type);
}

// Pure database operation functions
export function clearAllAgents(db: Database.Database): number {
  const result = db.prepare('DELETE FROM agents').run();
  return result.changes;
}

export function createAgent(db: Database.Database, type: 'developer' | 'architect' | 'tester'): number {
  if (!isValidAgentType(type)) {
    throw new Error(`Invalid agent type: ${type}`);
  }

  const stmt = db.prepare(`
    INSERT INTO agents (type, version) 
    VALUES (?, 1)
  `);
  
  const result = stmt.run(type);
  return result.lastInsertRowid as number;
}

export function clearWorkItemAssignments(db: Database.Database): number {
  const stmt = db.prepare(`
    UPDATE work_items 
    SET agent_id = NULL, started_at = NULL 
    WHERE agent_id IS NOT NULL OR started_at IS NOT NULL
  `);
  
  const result = stmt.run();
  return result.changes;
}

// Functional repository implementation - composing smaller functions
export function createFunctionalAgentRepository(database?: Database.Database): AgentRepository {
  const db = database || getDatabase();
  
  return {
    clearAll: async (): Promise<number> => clearAllAgents(db),
    create: async (type: 'developer' | 'architect' | 'tester'): Promise<number> => createAgent(db, type),
    clearWorkItemAssignments: async (): Promise<number> => clearWorkItemAssignments(db)
  };
}

/**
 * Factory function to create agent repository (functional style)
 */
export function createAgentRepository(database?: Database.Database): AgentRepository {
  return createFunctionalAgentRepository(database);
}