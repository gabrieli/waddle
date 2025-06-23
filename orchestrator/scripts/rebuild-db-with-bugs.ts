import { getDatabase, closeDatabase } from '../src/database/connection.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔄 Rebuilding database with bug support...\n');

const db = getDatabase();

try {
  console.log('📤 Exporting current data...');
  
  // Export work_items
  const workItems = db.prepare('SELECT * FROM work_items').all() as any[];
  console.log(`   Exported ${workItems.length} work items`);
  
  // Export work_history
  const workHistory = db.prepare('SELECT * FROM work_history').all() as any[];
  console.log(`   Exported ${workHistory.length} history entries`);
  
  // Close current connection
  closeDatabase();
  
  // Backup current database
  const dbPath = path.join(__dirname, '../orchestrator.db');
  const backupPath = path.join(__dirname, `../orchestrator.db.backup-${Date.now()}`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`\n💾 Backed up database to: ${backupPath}`);
  
  // Delete current database
  fs.unlinkSync(dbPath);
  try { fs.unlinkSync(dbPath + '-shm'); } catch (e) { /* ignore */ }
  try { fs.unlinkSync(dbPath + '-wal'); } catch (e) { /* ignore */ }
  console.log('🗑️  Removed old database files');
  
  // Reinitialize with new schema
  console.log('\n🏗️  Creating new database with bug support...');
  const { initializeDatabase } = await import('../src/database/connection.js');
  initializeDatabase();
  
  // Get new connection
  const newDb = getDatabase();
  
  // Re-import data
  console.log('\n📥 Importing data back...');
  
  // Import work_items
  const insertWorkItem = newDb.prepare(`
    INSERT INTO work_items (id, type, parent_id, title, description, status, assigned_role, processing_started_at, processing_agent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of workItems) {
    insertWorkItem.run(
      item.id, item.type, item.parent_id, item.title, item.description,
      item.status, item.assigned_role, item.processing_started_at,
      item.processing_agent_id, item.created_at, item.updated_at
    );
  }
  console.log(`   Imported ${workItems.length} work items`);
  
  // Import work_history
  const insertHistory = newDb.prepare(`
    INSERT INTO work_history (work_item_id, action, content, created_by, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (const history of workHistory) {
    insertHistory.run(
      history.work_item_id, history.action, history.content,
      history.created_by, history.created_at
    );
  }
  console.log(`   Imported ${workHistory.length} history entries`);
  
  // Test bug creation
  console.log('\n🧪 Testing bug creation...');
  newDb.prepare(`
    INSERT INTO work_items (id, type, title, status)
    VALUES ('BUG-TEST-001', 'bug', 'Test Bug', 'backlog')
  `).run();
  
  newDb.prepare('DELETE FROM work_items WHERE id = ?').run('BUG-TEST-001');
  console.log('✅ Bug type successfully added!');
  
} catch (error) {
  console.error('❌ Rebuild failed:', error);
  console.log('\n⚠️  Your backup is available if needed');
  process.exit(1);
}

console.log('\n✨ Database rebuilt successfully with bug support!');