#!/usr/bin/env node
import { loadConfig, OrchestratorConfig, getLoggerConfig } from './config.js';
import { initializeDatabase, getDatabase, closeDatabase } from '../database/connection.js';
import { getAllWorkItems, getWorkItemsByStatus, checkAndReleaseStaleWork, getAvailableWorkItems } from '../database/utils.js';
import { displayWorkItems } from './display.js';
import { runManagerAgent } from '../agents/manager.js';
import { runSingleManagerAgent } from '../agents/manager-single.js';
import { WorkItem } from '../types/index.js';
import { createLogger, getLogger } from '../utils/logger.js';
import { LearningWorker } from '../services/learning-worker.js';

let isShuttingDown = false;
let intervalId: NodeJS.Timeout | null = null;
let learningWorker: LearningWorker | null = null;

async function orchestratorLoop(config: OrchestratorConfig): Promise<void> {
  if (isShuttingDown) return;
  
  try {
    // Step 1: Clean up any stale locks
    const staleLocks = checkAndReleaseStaleWork();
    
    // Step 2: Get current state
    const workItems = getAllWorkItems();
    
    // Step 3: Display current state
    displayWorkItems(workItems);
    
    // Step 4: Get available work items (not locked, not done)
    const availableItems = getAvailableWorkItems();
    
    if (availableItems.length > 0) {
      console.log(`\n🔄 Processing ${availableItems.length} available work items...`);
      
      // Determine if we should use parallel or single manager
      const useParallel = process.env.PARALLEL_MODE === 'true' || config.parallelMode;
      
      if (useParallel) {
        // Step 5: Run manager agents in parallel (max 3 concurrent)
        const maxConcurrent = config.maxConcurrentManagers || 3;
        const itemsToProcess = availableItems.slice(0, maxConcurrent);
        
        console.log(`   Running ${itemsToProcess.length} manager agents in parallel...`);
        
        const managerPromises = itemsToProcess.map((item: WorkItem) => 
          runSingleManagerAgent(item.id, config).catch(err => {
            console.error(`Error processing ${item.id}:`, err);
          })
        );
        
        await Promise.all(managerPromises);
      } else {
        // Use original single manager for all items
        await runManagerAgent(config);
      }
    } else {
      console.log('\n✅ No available work items to process');
    }
    
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
    
    // Initialize logger with config
    const loggerConfig = getLoggerConfig(config);
    if (loggerConfig) {
      createLogger(loggerConfig);
      console.log('✅ Logger initialized');
    }
    
    const logger = getLogger();
    logger.info('Orchestrator starting', { 
      parallelMode: config.parallelMode,
      pollingInterval: config.pollingInterval 
    });
    
    // Initialize database
    initializeDatabase(config.database);
    console.log('✅ Database connected');
    
    // Initialize learning worker
    const db = getDatabase();
    if (config.learningEnabled !== false && db) {
      learningWorker = new LearningWorker(db, {
        enabled: true,
        extractionInterval: config.patternExtractionInterval || 30 * 60 * 1000,
        scoringInterval: config.effectivenessScoringInterval || 60 * 60 * 1000,
        cleanupInterval: config.patternCleanupInterval || 24 * 60 * 60 * 1000
      });
      
      await learningWorker.start();
      console.log('✅ Learning worker started');
      logger.info('Learning worker initialized and started');
    }
    
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

async function gracefulShutdown() {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  console.log('\n\n🛑 Shutting down orchestrator...');
  
  if (intervalId) {
    clearInterval(intervalId);
  }
  
  if (learningWorker) {
    await learningWorker.stop();
    console.log('✅ Learning worker stopped');
  }
  
  closeDatabase();
  console.log('✅ Database connection closed');
  console.log('👋 Goodbye!\n');
  
  process.exit(0);
}

// Start the orchestrator
main();