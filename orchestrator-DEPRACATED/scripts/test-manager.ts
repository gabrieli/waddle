import { runSingleManagerAgent } from '../src/agents/manager-single.js';
import { loadConfig } from '../src/orchestrator/config.js';

async function testManager() {
  console.log('🧪 Testing Manager Agent\n');
  
  try {
    const config = await loadConfig();
    console.log('✅ Config loaded successfully\n');
    
    // Test with the epic we have
    const epicId = 'EPIC-MC81PSB0-EL4';
    console.log(`Testing with ${epicId}...\n`);
    
    await runSingleManagerAgent(epicId, config);
    
    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testManager();