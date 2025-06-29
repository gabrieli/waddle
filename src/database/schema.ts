export interface WorkItem {
  id: string;
  type: 'epic' | 'story' | 'task' | 'bug';
  parent_id?: string;
  title: string;
  description?: string;
  status: 'backlog' | 'ready' | 'in_progress' | 'review' | 'done';
  assigned_role?: 'manager' | 'architect' | 'developer' | 'reviewer' | 'bug-buster';
  processing_started_at?: Date;
  processing_agent_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  work_item_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface WorkHistory {
  id: string;
  work_item_id: string;
  action: string;
  agent_id?: string;
  details?: any;
  created_at: Date;
}

export const createAgentsTableSQL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  work_item_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);

CREATE INDEX IF NOT EXISTS idx_agents_work_item_id ON agents(work_item_id);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
`;