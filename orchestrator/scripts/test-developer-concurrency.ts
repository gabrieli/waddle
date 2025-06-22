#!/usr/bin/env node
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import { getActiveDeveloperCount, canAssignDeveloper } from '../src/database/utils.js';
import { loadConfig } from '../src/orchestrator/config.js';

async function testDeveloperConcurrency() {
  console.log('🧪 Testing Developer Concurrency\n');
  
  try {
    // Load config
    const config = loadConfig();
    const maxDevelopers = config.maxConcurrentDevelopers || 1;
    console.log(`✅ Config loaded. Max concurrent developers: ${maxDevelopers}`);
    
    // Initialize database
    initializeDatabase(config.database);
    console.log('✅ Database connected');
    
    // Check current developer count
    const activeDevelopers = getActiveDeveloperCount();
    console.log(`\n📊 Current active developers: ${activeDevelopers}`);
    
    // Check if we can assign a developer
    const canAssign = canAssignDeveloper(maxDevelopers);
    console.log(`💻 Can assign new developer: ${canAssign ? 'YES ✅' : 'NO ❌'}`);
    
    if (!canAssign) {
      console.log(`   → Developer limit reached (${activeDevelopers}/${maxDevelopers})`);
    } else {
      console.log(`   → Slots available (${activeDevelopers}/${maxDevelopers})`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    closeDatabase();
    console.log('\n✅ Test complete');
  }
}

testDeveloperConcurrency();