#!/usr/bin/env node
import { loadConfig, OrchestratorConfig } from './config.js';
import { initializeDatabase, getDatabase, closeDatabase } from '../database/connection.js';
import { getAllWorkItems, getWorkItemsByStatus } from '../database/utils.js';
import { displayWorkItems } from './display.js';
import { WorkItem } from '../types/index.js';

let isShuttingDown = false;
let intervalId: NodeJS.Timeout | null = null;

async function orchestratorLoop(config: OrchestratorConfig): Promise<void> {
  if (isShuttingDown) return;
  
  try {
    // Step 1: Get current state
    const workItems = getAllWorkItems();
    
    // Step 2: Display current state
    displayWorkItems(workItems);
    
    // For now, we're just displaying - no manager agent yet
    // This will be added in a future story
    
  } catch (error) {
    console.error('Error in orchestrator loop:', error);
  }
}

async function main() {
  console.log('🚀 Starting Waddle Orchestrator...\n');
  
  try {
    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');
    
    // Initialize database
    initializeDatabase(config.database);
    console.log('✅ Database connected');
    
    // Set up graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    // Run initial loop
    await orchestratorLoop(config);
    
    // Set up polling interval
    console.log(`\n⏰ Polling every ${config.pollingInterval / 1000} seconds...`);
    console.log('Press Ctrl+C to stop\n');
    
    intervalId = setInterval(() => {
      orchestratorLoop(config);
    }, config.pollingInterval);
    
  } catch (error) {
    console.error('❌ Failed to start orchestrator:', error);
    process.exit(1);
  }
}

function gracefulShutdown() {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  console.log('\n\n🛑 Shutting down orchestrator...');
  
  if (intervalId) {
    clearInterval(intervalId);
  }
  
  closeDatabase();
  console.log('✅ Database connection closed');
  console.log('👋 Goodbye!\n');
  
  process.exit(0);
}

// Start the orchestrator
main();