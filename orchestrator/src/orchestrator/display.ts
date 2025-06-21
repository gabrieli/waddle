import { WorkItem } from '../types/index.js';
import { getChildWorkItems } from '../database/utils.js';

const STATUS_ICONS = {
  backlog: '📋',
  ready: '🟡',
  in_progress: '🔄',
  review: '👀',
  done: '✅'
};

const TYPE_ICONS = {
  epic: '🎯',
  story: '📖',
  task: '📝'
};

export function displayWorkItems(workItems: WorkItem[]): void {
  console.clear();
  console.log('='.repeat(80));
  console.log('🤖 WADDLE ORCHESTRATOR - Work Item Status');
  console.log('='.repeat(80));
  console.log(`Last updated: ${new Date().toLocaleString()}`);
  console.log('');
  
  if (workItems.length === 0) {
    console.log('No work items found. Use npm scripts to create some!');
    console.log('  - npm run create-epic     : Create a new epic');
    console.log('  - npm run create-story    : Create a new user story');
    console.log('  - npm run add-test-data   : Add test data');
    return;
  }
  
  // Group by epics
  const epics = workItems.filter(item => item.type === 'epic');
  const orphanItems = workItems.filter(item => item.type !== 'epic' && !item.parent_id);
  
  // Display epics and their children
  epics.forEach(epic => {
    displayWorkItemTree(epic, workItems);
  });
  
  // Display orphan items
  if (orphanItems.length > 0) {
    console.log('\n📦 Orphan Items (no parent):');
    orphanItems.forEach(item => {
      displayWorkItemLine(item, 0);
    });
  }
  
  // Summary
  console.log('\n' + '─'.repeat(80));
  displaySummary(workItems);
}

function displayWorkItemTree(item: WorkItem, allItems: WorkItem[], indent: number = 0): void {
  displayWorkItemLine(item, indent);
  
  // Get children from the provided list to avoid extra DB calls
  const children = allItems.filter(child => child.parent_id === item.id);
  children.forEach(child => {
    displayWorkItemTree(child, allItems, indent + 1);
  });
}

function displayWorkItemLine(item: WorkItem, indent: number): void {
  const prefix = '  '.repeat(indent);
  const typeIcon = TYPE_ICONS[item.type];
  const statusIcon = STATUS_ICONS[item.status];
  const role = item.assigned_role ? `[${item.assigned_role}]` : '';
  
  console.log(`${prefix}${typeIcon} ${statusIcon} ${item.id} - ${item.title} ${role}`);
  
  if (item.description && indent === 0) {
    const descLines = item.description.split('\n');
    descLines.forEach(line => {
      if (line.trim()) {
        console.log(`${prefix}    ${line.trim()}`);
      }
    });
  }
}

function displaySummary(workItems: WorkItem[]): void {
  const statusCounts = workItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📊 Summary:');
  console.log(`   Total items: ${workItems.length}`);
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    const icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS];
    console.log(`   ${icon} ${status}: ${count}`);
  });
  
  const inProgress = workItems.filter(item => item.status === 'in_progress').length;
  const pending = workItems.filter(item => 
    item.status === 'backlog' || item.status === 'ready'
  ).length;
  
  if (inProgress > 0) {
    console.log(`\n⚡ ${inProgress} item(s) currently in progress`);
  }
  
  if (pending > 0) {
    console.log(`📌 ${pending} item(s) waiting to be started`);
  }
}