#!/usr/bin/env node
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import { createWorkItem, generateId } from '../src/database/utils.js';
import { loadConfig } from '../src/orchestrator/config.js';
import { runSingleManagerAgent } from '../src/agents/manager-single.js';

async function testEpicValidation() {
  console.log('🧪 Testing Epic Validation\n');
  
  try {
    // Load config and initialize database
    const config = loadConfig();
    initializeDatabase(config.database);
    console.log('✅ Database connected');
    
    // Create a test epic that should be rejected
    const testEpicId = generateId('EPIC');
    createWorkItem(
      testEpicId,
      'epic',
      'Test Epic for Validation Testing',
      'This is a test epic created to verify that the manager properly rejects test epics that do not contribute to the Waddle product vision.',
      null,
      'backlog'
    );
    
    console.log(`✅ Created test epic: ${testEpicId}`);
    console.log('   Title: Test Epic for Validation Testing');
    console.log('   Status: backlog');
    
    // Run the single manager agent on this epic
    console.log('\n🎩 Running manager agent to validate epic...');
    await runSingleManagerAgent(testEpicId, config);
    
    // Check the result
    const db = require('better-sqlite3')(config.database);
    const epic = db.prepare('SELECT * FROM work_items WHERE id = ?').get(testEpicId);
    const history = db.prepare('SELECT * FROM work_history WHERE work_item_id = ? ORDER BY created_at DESC LIMIT 3').all(testEpicId);
    
    console.log('\n📊 Test Results:');
    console.log(`   Epic Status: ${epic.status}`);
    console.log(`   Latest History:`);
    
    history.forEach((h: any) => {
      console.log(`     - ${h.action}: ${h.content} (by ${h.created_by})`);
    });
    
    // Determine if test passed
    const isRejected = epic.status === 'done' && 
      history.some((h: any) => h.content?.includes('rejected') || h.content?.includes('Epic rejected'));
    
    if (isRejected) {
      console.log('\n✅ TEST PASSED: Epic was properly rejected');
      console.log('   Manager correctly identified test epic and rejected it');
    } else {
      console.log('\n❌ TEST FAILED: Epic was not rejected');
      console.log('   Manager should have rejected this test epic');
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    closeDatabase();
    console.log('\n✅ Test complete');
  }
}

testEpicValidation();