export const SCHEMA = {
  work_items: `
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('epic', 'story', 'task', 'bug')),
      parent_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('backlog', 'ready', 'in_progress', 'review', 'done')),
      assigned_role TEXT CHECK(assigned_role IN ('manager', 'architect', 'developer', 'reviewer', 'bug-buster')),
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
      action TEXT NOT NULL CHECK(action IN ('status_change', 'agent_output', 'decision', 'error')),
      content TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id)
    )
  `,
  
  bug_metadata: `
    CREATE TABLE IF NOT EXISTS bug_metadata (
      work_item_id TEXT PRIMARY KEY,
      reproduction_test TEXT,
      root_cause TEXT,
      reproduction_steps TEXT,
      temporary_artifacts TEXT,
      suggested_fix TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id)
    )
  `,
  
  patterns: `
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      agent_role TEXT NOT NULL CHECK(agent_role IN ('manager', 'architect', 'developer', 'reviewer', 'bug-buster')),
      pattern_type TEXT NOT NULL CHECK(pattern_type IN ('solution', 'approach', 'tool_usage', 'error_handling', 'optimization')),
      context TEXT NOT NULL,
      solution TEXT NOT NULL,
      effectiveness_score REAL DEFAULT 0.0 CHECK(effectiveness_score >= 0.0 AND effectiveness_score <= 1.0),
      usage_count INTEGER DEFAULT 0,
      work_item_ids TEXT,
      metadata TEXT,
      embedding TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  adrs: `
    CREATE TABLE IF NOT EXISTS adrs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      context TEXT NOT NULL,
      decision TEXT NOT NULL,
      consequences TEXT,
      status TEXT NOT NULL CHECK(status IN ('proposed', 'accepted', 'deprecated', 'superseded')),
      work_item_id TEXT,
      created_by TEXT NOT NULL,
      superseded_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id),
      FOREIGN KEY (superseded_by) REFERENCES adrs(id)
    )
  `,
  
  reviews: `
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      work_item_id TEXT NOT NULL,
      reviewer_role TEXT NOT NULL CHECK(reviewer_role IN ('manager', 'architect', 'developer', 'reviewer', 'bug-buster')),
      review_type TEXT NOT NULL CHECK(review_type IN ('code', 'architecture', 'security', 'testing', 'documentation')),
      status TEXT NOT NULL CHECK(status IN ('approved', 'needs_changes', 'rejected')),
      feedback TEXT NOT NULL,
      suggestions TEXT,
      quality_score REAL CHECK(quality_score >= 0.0 AND quality_score <= 1.0),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id)
    )
  `,
  
  agent_communications: `
    CREATE TABLE IF NOT EXISTS agent_communications (
      id TEXT PRIMARY KEY,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      message_type TEXT NOT NULL CHECK(message_type IN ('request', 'response', 'notification', 'query')),
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      work_item_id TEXT,
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      status TEXT NOT NULL CHECK(status IN ('pending', 'delivered', 'read', 'processed')) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      delivered_at TIMESTAMP,
      read_at TIMESTAMP,
      processed_at TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id)
    )
  `,
  
  // Index for faster queries
  indices: [
    `CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status)`,
    `CREATE INDEX IF NOT EXISTS idx_work_items_parent ON work_items(parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_work_history_work_item ON work_history(work_item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_patterns_agent_role ON patterns(agent_role)`,
    `CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type)`,
    `CREATE INDEX IF NOT EXISTS idx_patterns_effectiveness ON patterns(effectiveness_score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_adrs_status ON adrs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_adrs_work_item ON adrs(work_item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_work_item ON reviews(work_item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_comms_to_agent ON agent_communications(to_agent, status)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_comms_work_item ON agent_communications(work_item_id)`
  ]
};