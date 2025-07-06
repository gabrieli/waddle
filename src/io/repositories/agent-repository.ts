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

// Curried database operation functions
export const clearAllAgents = (db: Database.Database) => (): number => {
  const result = db.prepare('DELETE FROM agents').run();
  return result.changes;
};

export const createAgent = (db: Database.Database) => 
  (type: 'developer' | 'architect' | 'tester'): number => {
    if (!isValidAgentType(type)) {
      throw new Error(`Invalid agent type: ${type}`);
    }

    const stmt = db.prepare(`
      INSERT INTO agents (type, version) 
      VALUES (?, 1)
    `);
    
    const result = stmt.run(type);
    return result.lastInsertRowid as number;
  };

export const clearWorkItemAssignments = (db: Database.Database) => (): number => {
  const stmt = db.prepare(`
    UPDATE work_items 
    SET agent_id = NULL, started_at = NULL 
    WHERE agent_id IS NOT NULL OR started_at IS NOT NULL
  `);
  
  const result = stmt.run();
  return result.changes;
};

// Create agent operations with curried database dependency
export function createAgentOperations(db: Database.Database) {
  return {
    clearAll: clearAllAgents(db),
    create: createAgent(db),
    clearWorkItems: clearWorkItemAssignments(db)
  };
}

// Functional repository implementation using curried operations
export function createFunctionalAgentRepository(database?: Database.Database): AgentRepository {
  const db = database || getDatabase();
  const ops = createAgentOperations(db);
  
  return {
    clearAll: async (): Promise<number> => ops.clearAll(),
    create: async (type: 'developer' | 'architect' | 'tester'): Promise<number> => ops.create(type),
    clearWorkItemAssignments: async (): Promise<number> => ops.clearWorkItems()
  };
}

/**
 * Factory function to create agent repository (functional style)
 */
export function createAgentRepository(database?: Database.Database): AgentRepository {
  return createFunctionalAgentRepository(database);
}