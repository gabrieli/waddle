#!/usr/bin/env node
import { createWorkItem, generateId } from '../src/database/utils.js';
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';

function printUsage() {
  console.log('Usage: npm run create-epic -- --title "Epic Title" --description "Epic description"');
  console.log('');
  console.log('Options:');
  console.log('  --title, -t       Epic title (required)');
  console.log('  --description, -d Epic description (optional)');
  console.log('');
  console.log('Example:');
  console.log('  npm run create-epic -- --title "Implement User Authentication" --description "Add login and registration"');
}

function parseArgs(args: string[]): { title?: string; description?: string } {
  const result: { title?: string; description?: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    if ((arg === '--title' || arg === '-t') && nextArg) {
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
  
  const { title, description } = parseArgs(args);
  
  if (!title) {
    console.error('❌ Error: Title is required');
    printUsage();
    process.exit(1);
  }
  
  try {
    // Initialize database
    initializeDatabase();
    
    // Generate epic ID
    const epicId = generateId('EPIC');
    
    // Create the epic
    const epic = createWorkItem(
      epicId,
      'epic',
      title,
      description || null,
      null,
      'backlog'
    );
    
    console.log('✅ Epic created successfully!');
    console.log('');
    console.log('Epic Details:');
    console.log(`  ID:          ${epic.id}`);
    console.log(`  Title:       ${epic.title}`);
    console.log(`  Description: ${epic.description || '(none)'}`);
    console.log(`  Status:      ${epic.status}`);
    console.log(`  Created:     ${new Date(epic.created_at).toLocaleString()}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  - Create user stories: npm run create-story -- --epic ${epic.id} --title "Story title"`);
    console.log('  - View all work items: npm run view-work');
    console.log('  - Start orchestrator:  npm start');
    
  } catch (error) {
    console.error('❌ Failed to create epic:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();