import { createWorkItem, generateId, addHistory } from '../src/database/utils.js';

console.log('🐛 Creating test bug...\n');

const bugId = generateId('BUG');
const bug = createWorkItem(
  bugId,
  'bug',
  'Fix JSON parsing error in architect agent', 
  `The architect agent is failing to parse JSON responses from Claude.

Error details:
- Type: JSON_PARSE_ERROR  
- Message: Unexpected token 'E' in JSON at position 0
- Agent: architect
- Work item: EPIC-MC8A11R6-W42

Investigation steps:
1. Check if Claude is returning proper JSON format
2. Add better error handling for malformed responses
3. Log raw output before parsing for debugging
4. Consider fallback parsing strategies

This is preventing epics from being properly analyzed and broken down into stories.`,
  null,
  'ready'
);

console.log(`✅ Created bug: ${bugId}`);
addHistory(bugId, 'decision', 'Bug created from error detection', 'manager');

// Also create a story to show prioritization
const storyId = generateId('STORY');
createWorkItem(
  storyId,
  'story',
  'Add logging to database operations',
  'Add comprehensive logging to help debug issues',
  null,
  'ready'
);

console.log(`✅ Created story: ${storyId}`);

console.log('\n📋 Now we have:');
console.log('  - 1 Bug (ready) - should be processed FIRST');
console.log('  - 1 Story (ready) - should be processed after bug');
console.log('  - 1 Epic (backlog) - should be processed last');

console.log('\nRun "npm run view-work" to see the prioritization!');