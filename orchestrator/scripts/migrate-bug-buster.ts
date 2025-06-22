#!/usr/bin/env tsx
import { getDatabase } from '../src/database/connection.js';

console.log('🔄 Starting Bug Buster migration...');

const db = getDatabase();

// Disable foreign keys for the entire migration
  db.exec('PRAGMA foreign_keys = OFF');
  
  try {
    // Start transaction
    db.transaction(() => {
      // Step 1: Create a new table with the updated schema
      console.log('📋 Creating new work_items table with bug-buster role...');
      db.exec(`
        CREATE TABLE work_items_new (
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
      `);
      
      // Step 2: Copy data from old table
      console.log('📥 Copying existing data...');
      db.exec(`
        INSERT INTO work_items_new 
        SELECT * FROM work_items
      `);
      
      // Step 3: Drop old table
      console.log('🗑️  Dropping old table...');
      db.exec('DROP TABLE work_items');
      
      // Step 4: Rename new table
      console.log('✏️  Renaming new table...');
      db.exec('ALTER TABLE work_items_new RENAME TO work_items');
    
    // Step 5: Recreate indices
    console.log('📇 Recreating indices...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
      CREATE INDEX IF NOT EXISTS idx_work_items_parent ON work_items(parent_id);
    `);
    
    // Step 6: Add bug_metadata table for storing bug-specific data
    console.log('🐛 Creating bug_metadata table...');
    db.exec(`
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
    `);
    
      console.log('✅ Migration completed successfully!');
    })();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys = ON');
  }

// Verify the migration
const items = db.prepare('SELECT COUNT(*) as count FROM work_items').get() as { count: number };
console.log(`\n📊 Total work items after migration: ${items.count}`);

const bugs = db.prepare("SELECT COUNT(*) as count FROM work_items WHERE type = 'bug'").get() as { count: number };
console.log(`🐛 Total bugs: ${bugs.count}`);

console.log('\n🎉 Bug Buster migration complete!');