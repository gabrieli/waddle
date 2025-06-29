import { loadConfig } from '../src/orchestrator/config.js';
import { initializeDatabase } from '../src/database/connection.js';
import { getAvailableWorkItems, getWorkItemHistory, getRecentErrors } from '../src/database/utils.js';
import { buildManagerPrompt } from '../src/agents/prompts.js';
import { executeClaudeAgent } from '../src/agents/claude-executor.js';

async function testManagerDecision() {
  console.log('🧪 Testing manager decision with errors...\n');
  
  try {
    const config = await loadConfig();
    initializeDatabase();
    
    // Get available work items
    const workItems = getAvailableWorkItems();
    
    if (workItems.length === 0) {
      console.log('No available work items');
      return;
    }
    
    // Get recent history
    const recentHistory = workItems.slice(0, 5).map(item => {
      const history = getWorkItemHistory(item.id);
      return history.length > 0 
        ? `${item.id}: ${history[0].action} - ${history[0].content}`
        : `${item.id}: No history`;
    }).join('\\n');
    
    // Get recent errors
    const recentErrors = getRecentErrors(24);
    const errorsStr = recentErrors.length > 0
      ? recentErrors.map(e => `- ${e.error.agentType} agent failed on ${e.workItemId}: ${e.error.errorType} - ${e.error.errorMessage}`).join('\\n')
      : 'No recent errors';
    
    console.log(`Recent errors found: ${recentErrors.length}`);
    if (recentErrors.length > 0) {
      console.log('Errors:', errorsStr);
    }
    
    // Build and execute prompt
    const prompt = buildManagerPrompt(workItems, recentHistory, errorsStr);
    console.log('\\nExecuting manager...');
    
    const result = await executeClaudeAgent('manager', prompt, config);
    
    if (!result.success) {
      console.error('❌ Manager failed:', result.error);
      return;
    }
    
    console.log('\\n📤 Manager response:');
    console.log(result.output);
    
    // Try to parse
    try {
      const jsonMatch = result.output.match(/\\{[\\s\\S]*\\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        console.log('\\n📋 Parsed decision:');
        console.log(JSON.stringify(decision, null, 2));
      }
    } catch (e) {
      console.log('\\n⚠️  Could not parse JSON');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testManagerDecision();