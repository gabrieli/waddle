#!/usr/bin/env node
import { createWorkItem, generateId, getAllWorkItems } from '../src/database/utils.js';
import { initializeDatabase, closeDatabase, getDatabase } from '../src/database/connection.js';

async function cleanupTestData() {
  const db = getDatabase();
  
  // Delete test data in reverse order (children first)
  db.prepare(`DELETE FROM work_history WHERE work_item_id LIKE 'TEST-%'`).run();
  db.prepare(`DELETE FROM work_items WHERE id LIKE 'TEST-%'`).run();
  
  console.log('🧹 Cleaned up previous test data');
}

async function createTestData() {
  // Create test epic
  const epicId = 'TEST-EPIC-001';
  const epic = createWorkItem(
    epicId,
    'epic',
    'Test Epic: Validate Orchestrator',
    'This is a test epic to validate the orchestrator is working correctly',
    null,
    'backlog'
  );
  
  console.log(`✅ Created test epic: ${epic.id}`);
  
  // Create user stories
  const stories = [
    {
      id: 'TEST-STORY-001',
      title: 'As a developer, I want to see the orchestrator polling',
      description: 'Verify the orchestrator polls the database every 30 seconds',
      status: 'ready' as const
    },
    {
      id: 'TEST-STORY-002',
      title: 'As a user, I want to see work items in a hierarchy',
      description: 'Display epics with their child stories properly indented',
      status: 'in_progress' as const
    },
    {
      id: 'TEST-STORY-003',
      title: 'As a tester, I want to validate the display format',
      description: 'Ensure the terminal output is clear and well-formatted',
      status: 'backlog' as const
    }
  ];
  
  for (const storyData of stories) {
    const story = createWorkItem(
      storyData.id,
      'story',
      storyData.title,
      storyData.description,
      epicId,
      storyData.status
    );
    console.log(`✅ Created test story: ${story.id} [${story.status}]`);
  }
  
  // Create a test task under the second story
  const task = createWorkItem(
    'TEST-TASK-001',
    'task',
    'Update display colors for better visibility',
    'Use emojis and colors to make the output more readable',
    'TEST-STORY-002',
    'review'
  );
  console.log(`✅ Created test task: ${task.id} [${task.status}]`);
  
  return { epic, stories, task };
}

async function main() {
  try {
    // Initialize database
    initializeDatabase();
    
    console.log('🚀 Adding test data to the orchestrator database...\n');
    
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create new test data
    const testData = await createTestData();
    
    console.log('\n📊 Test Data Summary:');
    console.log('─'.repeat(50));
    console.log('Created:');
    console.log('  - 1 Epic (backlog)');
    console.log('  - 3 User Stories (1 ready, 1 in_progress, 1 backlog)');
    console.log('  - 1 Task (review)');
    console.log('\nTotal test items: 5');
    
    console.log('\n✨ Test data added successfully!');
    console.log('\nNext steps:');
    console.log('  1. Run the orchestrator: npm start');
    console.log('  2. You should see the test epic with its stories');
    console.log('  3. The display should update every 30 seconds');
    console.log('\nTo view test data only:');
    console.log('  npm run view-work');
    
  } catch (error) {
    console.error('❌ Failed to add test data:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();