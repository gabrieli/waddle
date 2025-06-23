import { getWorkItem, getChildWorkItems } from '../src/database/utils.js';

const epicId = 'EPIC-MC8B97HV-WCX';

console.log(`🔍 Checking epic ${epicId}...\n`);

// Get the epic
const epic = getWorkItem(epicId);

if (!epic) {
  console.log(`❌ Epic ${epicId} not found in database`);
  process.exit(1);
}

console.log(`📋 Epic Details:`);
console.log(`  ID: ${epic.id}`);
console.log(`  Title: ${epic.title}`);
console.log(`  Status: ${epic.status}`);
console.log(`  Created: ${epic.created_at}`);
console.log(`  Updated: ${epic.updated_at}`);

// Get child stories
const stories = getChildWorkItems(epicId);

console.log(`\n📚 User Stories (${stories.length} total):`);

if (stories.length === 0) {
  console.log('  No user stories found for this epic');
} else {
  // Group stories by status
  const storyGroups = stories.reduce((acc, story) => {
    if (!acc[story.status]) acc[story.status] = [];
    acc[story.status].push(story);
    return acc;
  }, {} as Record<string, typeof stories>);

  // Display stories by status
  const statusOrder = ['backlog', 'ready', 'in_progress', 'review', 'done'];
  
  for (const status of statusOrder) {
    const statusStories = storyGroups[status] || [];
    if (statusStories.length > 0) {
      console.log(`\n  ${status.toUpperCase()} (${statusStories.length}):`);
      statusStories.forEach(story => {
        console.log(`    - ${story.id}: ${story.title}`);
        if (story.processing_agent_id) {
          console.log(`      🤖 Currently being processed by: ${story.processing_agent_id}`);
        }
      });
    }
  }
}

// Summary
console.log('\n📊 Summary:');
const statusCounts = stories.reduce((acc, story) => {
  acc[story.status] = (acc[story.status] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});

const doneCount = statusCounts.done || 0;
const totalCount = stories.length;
const completionPercentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

console.log(`\n  Progress: ${doneCount}/${totalCount} stories completed (${completionPercentage}%)`);