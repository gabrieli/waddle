import { loadConfig } from '../src/orchestrator/config.js';
import { initializeDatabase } from '../src/database/connection.js';
import { runManagerAgent } from '../src/agents/manager.js';

async function runOnce() {
  console.log('🎩 Running manager agent once...\n');
  
  try {
    const config = await loadConfig();
    initializeDatabase();
    
    await runManagerAgent(config);
    
    console.log('\n✅ Manager run complete');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runOnce();