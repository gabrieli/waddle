/**
 * Database schema definitions for Waddle
 */

export const schema = {
  features: `
    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'complete', 'failed')),
      priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      metadata TEXT,
      CHECK (json_valid(metadata) OR metadata IS NULL)
    )
  `,

  tasks: `
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('architect', 'developer', 'reviewer')),
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'complete', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      output TEXT,
      error TEXT,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
      CHECK (json_valid(output) OR output IS NULL)
    )
  `,

  transitions: `
    CREATE TABLE IF NOT EXISTS transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('feature', 'task')),
      entity_id TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      reason TEXT,
      actor TEXT NOT NULL CHECK (actor IN ('system', 'user', 'ai')),
      created_at INTEGER NOT NULL,
      metadata TEXT,
      CHECK (json_valid(metadata) OR metadata IS NULL)
    )
  `,

  context: `
    CREATE TABLE IF NOT EXISTS context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('architecture', 'review', 'implementation')),
      content TEXT NOT NULL,
      author TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
    )
  `,

  audit_log: `
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      actor TEXT,
      details TEXT,
      created_at INTEGER NOT NULL,
      CHECK (json_valid(details) OR details IS NULL)
    )
  `,

  migrations: `
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `
};

export const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_features_status ON features(status)',
  'CREATE INDEX IF NOT EXISTS idx_features_priority ON features(priority)',
  'CREATE INDEX IF NOT EXISTS idx_features_created_at ON features(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_feature_id ON tasks(feature_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_role ON tasks(role)',
  'CREATE INDEX IF NOT EXISTS idx_transitions_entity ON transitions(entity_type, entity_id)',
  'CREATE INDEX IF NOT EXISTS idx_transitions_created_at ON transitions(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_context_feature_id ON context(feature_id)',
  'CREATE INDEX IF NOT EXISTS idx_context_type ON context(type)',
  'CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)'
];