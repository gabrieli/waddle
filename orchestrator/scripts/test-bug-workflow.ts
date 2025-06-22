#!/usr/bin/env tsx
import { getDatabase } from '../src/database/connection.js';
import { createWorkItem, addHistory } from '../src/database/utils.js';

console.log('🧪 Testing Bug Workflow...\n');

const db = getDatabase();

// Create a test bug
const bugId = 'BUG-TEST-001';
console.log('1. Creating test bug:', bugId);

createWorkItem(
  bugId,
  'bug',
  'Test Application Crashes on Large Input',
  'The application crashes when processing files larger than 100MB. Error: ENOMEM',
  null,
  'backlog'
);

// Simulate an error that would trigger this bug
console.log('2. Adding error history to simulate the issue...');
addHistory(bugId, 'error', JSON.stringify({
  errorType: 'MEMORY_ERROR',
  errorMessage: 'JavaScript heap out of memory',
  agentType: 'developer',
  stack: `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
    at processLargeFile (src/processor.js:45:10)
    at main (src/index.js:12:5)`,
  workItemId: 'STORY-123',
  timestamp: new Date().toISOString()
}), 'system');

console.log('\n✅ Test bug created successfully!');
console.log('\nBug Workflow:');
console.log('1. Manager will detect this bug in backlog status');
console.log('2. Manager assigns it to Bug Buster');
console.log('3. Bug Buster investigates and creates reproduction test');
console.log('4. Bug moves to ready status');
console.log('5. Manager assigns ready bug to Developer');
console.log('6. Developer fixes using reproduction test and cleans artifacts');
console.log('7. Bug moves to review');
console.log('8. Code Quality Reviewer verifies fix and tests');
console.log('9. Bug marked as done');

// Query to show the bug
const bug = db.prepare('SELECT * FROM work_items WHERE id = ?').get(bugId);
console.log('\nCreated bug:', JSON.stringify(bug, null, 2));