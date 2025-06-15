#!/usr/bin/env ts-node

import Database from 'better-sqlite3';
import { join } from 'path';

async function viewMCPFeature() {
  const dbPath = join(__dirname, '..', 'waddle.db');
  const db = new Database(dbPath);
  
  try {
    // Get the feature
    const feature = db.prepare(`
      SELECT * FROM features WHERE id = ?
    `).get('0819c29a-baa3-4e73-8e76-7f19a40c12f3') as any;
    
    // Get the task
    const task = db.prepare(`
      SELECT * FROM tasks WHERE feature_id = ? AND role = 'architect'
    `).get('0819c29a-baa3-4e73-8e76-7f19a40c12f3') as any;
    
    // Get the acceptance criteria context
    const context = db.prepare(`
      SELECT * FROM context WHERE feature_id = ? AND type = 'architecture'
    `).get('0819c29a-baa3-4e73-8e76-7f19a40c12f3') as any;
    
    console.log('📋 MCP Server Fix Feature Details:\n');
    console.log('Feature:', {
      id: feature.id,
      status: feature.status,
      priority: feature.priority,
      created: feature.created_at
    });
    
    console.log('\n📝 Feature Description:');
    console.log(feature.description);
    
    console.log('\n👷 Architect Task:', {
      id: task.id,
      status: task.status,
      description: task.description
    });
    
    if (context) {
      console.log('\n✅ Acceptance Criteria:');
      console.log(context.content);
    }
    
    db.close();
  } catch (error) {
    console.error('❌ Error viewing feature:', error);
    db.close();
    process.exit(1);
  }
}

viewMCPFeature().catch(console.error);