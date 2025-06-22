import { getDatabase } from '../src/database/connection.js';

console.log('🔄 Migrating database for error tracking...\n');

const db = getDatabase();

try {
  // Check if 'error' is already a valid action
  const checkStmt = db.prepare(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='work_history'
  `);
  
  const tableInfo = checkStmt.get() as { sql: string };
  console.log('Current table schema:', tableInfo.sql);
  
  if (!tableInfo.sql.includes("'error'")) {
    console.log('\n⚠️  Need to recreate work_history table with updated constraint...');
    
    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Create new table with updated constraint
      db.prepare(`
        CREATE TABLE IF NOT EXISTS work_history_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          work_item_id TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('status_change', 'agent_output', 'decision', 'error')),
          content TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (work_item_id) REFERENCES work_items(id)
        )
      `).run();
      
      // Copy data from old table
      db.prepare(`
        INSERT INTO work_history_new (id, work_item_id, action, content, created_by, created_at)
        SELECT id, work_item_id, action, content, created_by, created_at
        FROM work_history
      `).run();
      
      // Drop old table
      db.prepare('DROP TABLE work_history').run();
      
      // Rename new table
      db.prepare('ALTER TABLE work_history_new RENAME TO work_history').run();
      
      // Recreate indices
      db.prepare('CREATE INDEX IF NOT EXISTS idx_work_history_work_item ON work_history(work_item_id)').run();
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      console.log('✅ Successfully migrated work_history table');
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } else {
    console.log('✅ Database already supports error tracking');
  }
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n✨ Migration complete!');