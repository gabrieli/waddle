#!/usr/bin/env node
import { getAllWorkItems, getWorkItemsByStatus } from '../src/database/utils.js';
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import { WorkItem, WorkItemStatus } from '../src/types/index.js';

function printUsage() {
  console.log('Usage: npm run view-work [-- --status <status>]');
  console.log('');
  console.log('Options:');
  console.log('  --status, -s  Filter by status (backlog, ready, in_progress, review, done)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run view-work                    # Show all work items');
  console.log('  npm run view-work -- --status backlog  # Show only backlog items');
}

function parseArgs(args: string[]): { status?: WorkItemStatus } {
  const result: { status?: WorkItemStatus } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    if ((arg === '--status' || arg === '-s') && nextArg) {
      const validStatuses: WorkItemStatus[] = ['backlog', 'ready', 'in_progress', 'review', 'done'];
      if (validStatuses.includes(nextArg as WorkItemStatus)) {
        result.status = nextArg as WorkItemStatus;
      } else {
        console.error(`❌ Error: Invalid status "${nextArg}". Valid options: ${validStatuses.join(', ')}`);
        process.exit(1);
      }
      i++;
    }
  }
  
  return result;
}

function displayWorkItems(items: WorkItem[]) {
  if (items.length === 0) {
    console.log('No work items found.');
    return;
  }
  
  // Group by type
  const epics = items.filter(item => item.type === 'epic');
  const stories = items.filter(item => item.type === 'story');
  const tasks = items.filter(item => item.type === 'task');
  const bugs = items.filter(item => item.type === 'bug');
  
  // Build hierarchy map
  const childrenMap = new Map<string, WorkItem[]>();
  items.forEach(item => {
    if (item.parent_id) {
      const siblings = childrenMap.get(item.parent_id) || [];
      siblings.push(item);
      childrenMap.set(item.parent_id, siblings);
    }
  });
  
  console.log('');
  console.log('📋 WORK ITEMS');
  console.log('='.repeat(80));
  console.log('');
  
  // Display epics with their children
  epics.forEach(epic => {
    displayItem(epic, 0, childrenMap);
    console.log('');
  });
  
  // Display orphan stories
  const orphanStories = stories.filter(s => !s.parent_id || !epics.find(e => e.id === s.parent_id));
  if (orphanStories.length > 0) {
    console.log('📦 Orphan Stories:');
    orphanStories.forEach(story => {
      displayItem(story, 0, childrenMap);
    });
    console.log('');
  }
  
  // Display orphan tasks
  const orphanTasks = tasks.filter(t => !t.parent_id || !items.find(i => i.id === t.parent_id));
  if (orphanTasks.length > 0) {
    console.log('📦 Orphan Tasks:');
    orphanTasks.forEach(task => {
      displayItem(task, 0, childrenMap);
    });
    console.log('');
  }
  
  // Display bugs (always at top level)
  if (bugs.length > 0) {
    console.log('🚨 Bugs (High Priority):');
    bugs.forEach(bug => {
      displayItem(bug, 0, childrenMap);
    });
    console.log('');
  }
  
  // Summary
  console.log('─'.repeat(80));
  console.log('SUMMARY:');
  console.log(`  Total items: ${items.length}`);
  console.log(`  Epics: ${epics.length}, Stories: ${stories.length}, Tasks: ${tasks.length}, Bugs: ${bugs.length}`);
  
  // Status breakdown
  const statusCounts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('');
  console.log('Status breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

function displayItem(item: WorkItem, indent: number, childrenMap: Map<string, WorkItem[]>) {
  const prefix = '  '.repeat(indent);
  const typeEmoji = { epic: '🎯', story: '📖', task: '📝', bug: '🐛' }[item.type];
  const statusBadge = `[${item.status.toUpperCase()}]`;
  
  console.log(`${prefix}${typeEmoji} ${item.id} ${statusBadge} - ${item.title}`);
  
  if (item.description) {
    console.log(`${prefix}   ${item.description}`);
  }
  
  if (item.assigned_role) {
    console.log(`${prefix}   Assigned to: ${item.assigned_role}`);
  }
  
  console.log(`${prefix}   Created: ${new Date(item.created_at).toLocaleString()}`);
  
  // Display children
  const children = childrenMap.get(item.id) || [];
  children.forEach(child => {
    console.log('');
    displayItem(child, indent + 1, childrenMap);
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const { status } = parseArgs(args);
  
  try {
    // Initialize database
    initializeDatabase();
    
    // Get work items
    const items = status 
      ? getWorkItemsByStatus(status)
      : getAllWorkItems();
    
    if (status) {
      console.log(`\n🔍 Filtering by status: ${status}`);
    }
    
    displayWorkItems(items);
    
  } catch (error) {
    console.error('❌ Failed to view work items:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();