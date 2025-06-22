export const SCHEMA = {
  work_items: `
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('epic', 'story', 'task')),
      parent_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('backlog', 'ready', 'in_progress', 'review', 'done')),
      assigned_role TEXT CHECK(assigned_role IN ('manager', 'architect', 'developer', 'code_quality_reviewer')),
      processing_started_at TIMESTAMP,
      processing_agent_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES work_items(id)
    )
  `,
  
  work_history: `
    CREATE TABLE IF NOT EXISTS work_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_item_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('status_change', 'agent_output', 'decision')),
      content TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id)
    )
  `,
  
  // Index for faster queries
  indices: [
    `CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status)`,
    `CREATE INDEX IF NOT EXISTS idx_work_items_parent ON work_items(parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_work_history_work_item ON work_history(work_item_id)`
  ]
};