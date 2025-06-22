import { getAvailableWorkItems, getWorkItemHistory, getRecentErrors } from '../src/database/utils.js';
import { buildManagerPrompt } from '../src/agents/prompts.js';
import { initializeDatabase } from '../src/database/connection.js';

initializeDatabase();

console.log('🧪 Testing manager prompt generation...\n');

// Get available work items
const workItems = getAvailableWorkItems();
console.log(`Found ${workItems.length} available work items`);

// Get recent history
const recentHistory = workItems.slice(0, 5).map(item => {
  const history = getWorkItemHistory(item.id);
  return history.length > 0 
    ? `${item.id}: ${history[0].action} - ${history[0].content}`
    : `${item.id}: No history`;
}).join('\n');

// Get recent errors
const recentErrors = getRecentErrors(24);
const errorsStr = recentErrors.length > 0
  ? recentErrors.map(e => `- ${e.error.agentType} agent failed on ${e.workItemId}: ${e.error.errorType} - ${e.error.errorMessage}`).join('\n')
  : 'No recent errors';

console.log(`\nRecent errors: ${recentErrors.length}`);
if (recentErrors.length > 0) {
  console.log(errorsStr);
}

// Build prompt
const prompt = buildManagerPrompt(workItems, recentHistory, errorsStr);

console.log('\n=== GENERATED PROMPT ===');
console.log(prompt);
console.log('=== END PROMPT ===');