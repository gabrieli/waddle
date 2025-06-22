import { getRecentErrors } from '../src/database/utils.js';

console.log('🔍 Checking for recent errors...\n');

const errors = getRecentErrors(24);

if (errors.length === 0) {
  console.log('✅ No errors in the last 24 hours');
} else {
  console.log(`Found ${errors.length} error(s):\n`);
  
  errors.forEach((e, index) => {
    console.log(`Error ${index + 1}:`);
    console.log(`  Work Item: ${e.workItemId}`);
    console.log(`  Agent: ${e.error.agentType}`);
    console.log(`  Error Type: ${e.error.errorType}`);
    console.log(`  Message: ${e.error.errorMessage}`);
    console.log(`  Timestamp: ${e.error.timestamp}`);
    console.log(`  Raw Output: ${e.error.rawOutput?.substring(0, 100)}...`);
    console.log('');
  });
}