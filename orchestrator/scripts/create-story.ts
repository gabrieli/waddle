#!/usr/bin/env node
import { createWorkItem, generateId, getWorkItem } from '../src/database/utils.js';
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';

function printUsage() {
  console.log('Usage: npm run create-story -- --epic <epic-id> --title "Story Title" --description "Story description"');
  console.log('');
  console.log('Options:');
  console.log('  --epic, -e        Parent epic ID (required)');
  console.log('  --title, -t       Story title (required)');
  console.log('  --description, -d Story description (optional)');
  console.log('');
  console.log('Example:');
  console.log('  npm run create-story -- --epic EPIC-123 --title "As a user, I want login" --description "Implement login flow"');
}

function parseArgs(args: string[]): { epic?: string; title?: string; description?: string } {
  const result: { epic?: string; title?: string; description?: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    if ((arg === '--epic' || arg === '-e') && nextArg) {
      result.epic = nextArg;
      i++;
    } else if ((arg === '--title' || arg === '-t') && nextArg) {
      result.title = nextArg;
      i++;
    } else if ((arg === '--description' || arg === '-d') && nextArg) {
      result.description = nextArg;
      i++;
    }
  }
  
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const { epic, title, description } = parseArgs(args);
  
  if (!epic) {
    console.error('❌ Error: Epic ID is required');
    printUsage();
    process.exit(1);
  }
  
  if (!title) {
    console.error('❌ Error: Title is required');
    printUsage();
    process.exit(1);
  }
  
  try {
    // Initialize database
    initializeDatabase();
    
    // Validate parent epic exists
    const parentEpic = getWorkItem(epic);
    if (!parentEpic) {
      console.error(`❌ Error: Epic with ID "${epic}" not found`);
      console.log('');
      console.log('Tip: Use "npm run view-work" to see all available epics');
      process.exit(1);
    }
    
    if (parentEpic.type !== 'epic') {
      console.error(`❌ Error: Parent item "${epic}" is not an epic (type: ${parentEpic.type})`);
      process.exit(1);
    }
    
    // Generate story ID
    const storyId = generateId('STORY');
    
    // Create the story
    const story = createWorkItem(
      storyId,
      'story',
      title,
      description || null,
      epic,
      'backlog'
    );
    
    console.log('✅ User story created successfully!');
    console.log('');
    console.log('Story Details:');
    console.log(`  ID:          ${story.id}`);
    console.log(`  Title:       ${story.title}`);
    console.log(`  Description: ${story.description || '(none)'}`);
    console.log(`  Parent Epic: ${parentEpic.title} (${epic})`);
    console.log(`  Status:      ${story.status}`);
    console.log(`  Created:     ${new Date(story.created_at).toLocaleString()}`);
    console.log('');
    console.log('Next steps:');
    console.log('  - View all work items: npm run view-work');
    console.log('  - Start orchestrator:  npm start');
    
  } catch (error) {
    console.error('❌ Failed to create story:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();