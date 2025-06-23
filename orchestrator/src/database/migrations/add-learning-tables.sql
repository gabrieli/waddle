-- Add learning metrics tables

-- Table to store learning cycle metrics
CREATE TABLE IF NOT EXISTS learning_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_type TEXT NOT NULL,
  metrics TEXT NOT NULL, -- JSON data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table to store learning errors
CREATE TABLE IF NOT EXISTS learning_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add index for pattern work item relationships
CREATE INDEX IF NOT EXISTS idx_pattern_work_items_pattern_id 
ON pattern_work_items(pattern_id);

CREATE INDEX IF NOT EXISTS idx_pattern_work_items_work_item_id 
ON pattern_work_items(work_item_id);

-- Add indexes for learning metrics queries
CREATE INDEX IF NOT EXISTS idx_learning_metrics_cycle_type 
ON learning_metrics(cycle_type);

CREATE INDEX IF NOT EXISTS idx_learning_metrics_created_at 
ON learning_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_learning_errors_cycle_type 
ON learning_errors(cycle_type);

CREATE INDEX IF NOT EXISTS idx_learning_errors_created_at 
ON learning_errors(created_at);

-- Add archived patterns table
CREATE TABLE IF NOT EXISTS archived_patterns (
  id TEXT PRIMARY KEY,
  context TEXT NOT NULL,
  solution TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  effectiveness_score REAL NOT NULL,
  usage_count INTEGER DEFAULT 0,
  embedding TEXT,
  created_at DATETIME NOT NULL,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archive_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_archived_patterns_archived_at 
ON archived_patterns(archived_at);