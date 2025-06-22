import { getDatabase } from '../src/database/connection.js';

console.log('🔄 Migrating database to add bug type...\n');

const db = getDatabase();

try {
  // Check if 'bug' is already a valid type
  const checkStmt = db.prepare(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='work_items'
  `);
  
  const tableInfo = checkStmt.get() as { sql: string };
  console.log('Current table schema:', tableInfo.sql.substring(0, 200) + '...');
  
  if (!tableInfo.sql.includes("'bug'")) {
    console.log('\n⚠️  Need to recreate work_items table with bug type...');
    
    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Temporarily disable foreign keys
      db.pragma('foreign_keys = OFF');
      // Create new table with updated constraint
      db.prepare(`
        CREATE TABLE IF NOT EXISTS work_items_new (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('epic', 'story', 'task', 'bug')),
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
      `).run();
      
      // Copy data from old table
      db.prepare(`
        INSERT INTO work_items_new
        SELECT * FROM work_items
      `).run();
      
      // Update work_history foreign keys to point to new table
      db.prepare(`
        CREATE TABLE work_history_temp AS
        SELECT * FROM work_history
      `).run();
      
      db.prepare('DROP TABLE work_history').run();
      
      // Drop old work_items table
      db.prepare('DROP TABLE work_items').run();
      
      // Rename new table
      db.prepare('ALTER TABLE work_items_new RENAME TO work_items').run();
      
      // Recreate work_history with proper foreign key
      db.prepare(`
        CREATE TABLE work_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          work_item_id TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('status_change', 'agent_output', 'decision', 'error')),
          content TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (work_item_id) REFERENCES work_items(id)
        )
      `).run();
      
      // Restore work_history data
      db.prepare(`
        INSERT INTO work_history
        SELECT * FROM work_history_temp
      `).run();
      
      db.prepare('DROP TABLE work_history_temp').run();
      
      // Recreate indices
      db.prepare('CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_work_items_parent ON work_items(parent_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_work_history_work_item ON work_history(work_item_id)').run();
      
      // Re-enable foreign keys
      db.pragma('foreign_keys = ON');
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      console.log('✅ Successfully added bug type to work_items');
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } else {
    console.log('✅ Database already supports bug type');
  }
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n✨ Migration complete!');