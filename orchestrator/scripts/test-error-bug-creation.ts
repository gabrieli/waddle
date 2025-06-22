import { createWorkItem, generateId, addHistory } from '../src/database/utils.js';

console.log('🧪 Testing self-healing bug creation...\n');

// Create a test epic
const epicId = generateId('EPIC');
createWorkItem(
  epicId,
  'epic',
  'Test Epic for Error Simulation',
  'This epic will trigger an error in the architect agent',
  null,
  'backlog'
);

console.log(`✅ Created test epic: ${epicId}`);

// Simulate an architect error
const errorDetails = {
  errorType: 'JSON_PARSE_ERROR',
  errorMessage: 'Unexpected token \'E\' in JSON at position 0',
  agentType: 'architect',
  expectedFormat: 'ArchitectAnalysisResult JSON',
  rawOutput: 'Execution error: Claude returned invalid response format',
  workItemId: epicId,
  epicTitle: 'Test Epic for Error Simulation',
  timestamp: new Date().toISOString()
};

// Add error to history (simulating what the architect would do)
addHistory(epicId, 'error', JSON.stringify(errorDetails), 'architect');
addHistory(epicId, 'agent_output', 'Failed to parse architect analysis - error recorded for investigation', 'architect');

console.log('❌ Simulated architect error');
console.log('\nError details:');
console.log(`  Type: ${errorDetails.errorType}`);
console.log(`  Message: ${errorDetails.errorMessage}`);
console.log(`  Agent: ${errorDetails.agentType}`);

console.log('\n📋 When the manager runs next, it should:');
console.log('  1. Detect this error in the history');
console.log('  2. Create a bug to fix the JSON parsing issue');
console.log('  3. Prioritize the bug over other work items');

console.log('\nRun "npm start" to see the self-healing in action!');