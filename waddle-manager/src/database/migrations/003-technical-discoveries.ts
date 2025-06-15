import type { Database } from 'better-sqlite3';

export const up = (db: Database): void => {
  // Create technical discoveries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS technical_discoveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_id TEXT NOT NULL,
      discovery_type TEXT NOT NULL CHECK (discovery_type IN (
        'pattern', 'dependency', 'risk', 'constraint', 
        'integration_point', 'performance_consideration'
      )),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      impact TEXT CHECK (impact IN ('low', 'medium', 'high', 'critical')),
      resolution_strategy TEXT,
      discovered_at INTEGER NOT NULL,
      resolved_at INTEGER,
      metadata TEXT,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
      CHECK (json_valid(metadata) OR metadata IS NULL)
    );

    CREATE INDEX idx_discoveries_feature_id ON technical_discoveries(feature_id);
    CREATE INDEX idx_discoveries_type ON technical_discoveries(discovery_type);
    CREATE INDEX idx_discoveries_impact ON technical_discoveries(impact);
  `);

  // Create user stories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stories (
      id TEXT PRIMARY KEY,
      epic_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      story_points INTEGER,
      business_value INTEGER,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'ready', 'in_progress', 'testing', 'done', 'blocked'
      )),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      metadata TEXT,
      FOREIGN KEY (epic_id) REFERENCES features(id) ON DELETE SET NULL,
      CHECK (json_valid(acceptance_criteria) OR acceptance_criteria IS NULL),
      CHECK (json_valid(metadata) OR metadata IS NULL)
    );

    CREATE INDEX idx_stories_epic_id ON user_stories(epic_id);
    CREATE INDEX idx_stories_status ON user_stories(status);
  `);

  // Create architecture decisions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS architecture_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_id TEXT NOT NULL,
      decision_type TEXT NOT NULL CHECK (decision_type IN (
        'technology', 'pattern', 'structure', 'integration'
      )),
      title TEXT NOT NULL,
      context TEXT NOT NULL,
      decision TEXT NOT NULL,
      consequences TEXT,
      alternatives_considered TEXT,
      created_at INTEGER NOT NULL,
      author TEXT NOT NULL,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
      CHECK (json_valid(alternatives_considered) OR alternatives_considered IS NULL)
    );

    CREATE INDEX idx_decisions_feature_id ON architecture_decisions(feature_id);
    CREATE INDEX idx_decisions_type ON architecture_decisions(decision_type);
  `);

  // Create task_user_stories junction table to link tasks to user stories
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_user_stories (
      task_id INTEGER NOT NULL,
      user_story_id TEXT NOT NULL,
      PRIMARY KEY (task_id, user_story_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_story_id) REFERENCES user_stories(id) ON DELETE CASCADE
    );
  `);
};

export const down = (db: Database): void => {
  db.exec(`
    DROP TABLE IF EXISTS task_user_stories;
    DROP TABLE IF EXISTS architecture_decisions;
    DROP TABLE IF EXISTS user_stories;
    DROP TABLE IF EXISTS technical_discoveries;
  `);
};