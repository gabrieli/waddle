import { updateWorkItemStatus, getWorkItem, updateEpicBasedOnStories, getChildWorkItems } from '../src/database/utils.js';

console.log('🧪 Testing epic status updates...\n');

// Test 1: Check current epic status
const epicId = 'TEST-EPIC-001';
let epic = getWorkItem(epicId);
console.log(`Epic ${epicId} current status: ${epic?.status}`);

// Check stories
const stories = getChildWorkItems(epicId);
console.log(`\nStories for ${epicId}:`);
stories.forEach(story => {
  console.log(`  - ${story.id}: ${story.status}`);
});

// Test 2: When a story moves to ready, epic should go to in_progress
console.log('\n📝 Moving TEST-STORY-003 to ready...');
updateWorkItemStatus('TEST-STORY-003', 'ready', 'test-script');
updateEpicBasedOnStories(epicId, 'test-script');

epic = getWorkItem(epicId);
console.log(`Epic ${epicId} status after story moved to ready: ${epic?.status}`);

// Test 3: Mark all stories as done
console.log('\n✅ Marking all stories as done...');
stories.forEach(story => {
  updateWorkItemStatus(story.id, 'done', 'test-script');
});

// Update epic based on stories
updateEpicBasedOnStories(epicId, 'test-script');

epic = getWorkItem(epicId);
console.log(`Epic ${epicId} status after all stories done: ${epic?.status}`);

// Show final state
console.log('\n📊 Final state:');
console.log(`Epic: ${epic?.status}`);
getChildWorkItems(epicId).forEach(story => {
  console.log(`  - ${story.id}: ${story.status}`);
});