import { getDatabase } from '../src/database/connection.js';

const db = getDatabase();

// Check current locked work items
const lockedItems = db.prepare('SELECT id, processing_agent_id FROM work_items WHERE processing_agent_id IS NOT NULL').all();
console.log('Currently locked items:', lockedItems);

// Force release all locks
const result = db.prepare('UPDATE work_items SET processing_agent_id = NULL, processing_started_at = NULL WHERE processing_agent_id IS NOT NULL').run();
console.log(`\n✅ Released ${result.changes} work items`);