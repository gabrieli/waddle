#!/usr/bin/env ts-node

import Database from 'better-sqlite3';
import { join } from 'path';
import { FeatureRepository, TaskRepository } from '../src/database/repositories';

async function createMCPFixFeature() {
  const dbPath = join(__dirname, '..', 'waddle.db');
  const db = new Database(dbPath);
  
  try {
    const featureRepo = new FeatureRepository(db);
    const taskRepo = new TaskRepository(db);
    
    // Create the feature
    const feature = featureRepo.create({
      description: `Fix MCP server connection issues preventing Claude from connecting to http://localhost:5173
      
      Issue: Claude instances are unable to connect to the MCP server at http://localhost:5173, showing "Status: ✘ failed" error.
      
      Requirements:
      - Investigate why MCP server is not accessible at localhost:5173
      - Check if the server is actually starting and binding to the correct port
      - Verify the MCP server implementation in src/mcp-server/index.ts
      - Fix connection handshake and protocol issues
      - Implement proper error handling and retry logic
      - Add connection health checks and status monitoring
      - Ensure proper CORS and network configuration
      - Add comprehensive logging for debugging connection issues
      - Test with the test-mcp-connection.js script
      
      Expected Outcome:
      - MCP server runs reliably on port 5173
      - Claude instances can connect successfully
      - Clear error messages when connection fails
      - Ability to monitor connection status`,
      priority: 'critical',
      metadata: {
        type: 'bug-fix',
        component: 'mcp-server',
        urgency: 'blocking-development',
        relatedFiles: [
          'src/mcp-server/index.ts',
          'src/mcp-server/tools.ts',
          'src/executor/headless-claude.ts',
          'test-mcp-connection.js',
          'MCP_SERVER_DEBUG.md'
        ],
        testCommand: 'node test-mcp-connection.js'
      }
    });
    
    // Create initial architect task
    const task = taskRepo.create({
      featureId: feature.id,
      role: 'architect',
      description: 'Design comprehensive solution for MCP server connection issues including debugging current implementation, identifying root causes, and proposing fixes'
    });
    
    console.log(`✅ Created feature: ${feature.id}`);
    console.log(`📋 Created architect task: ${task.id}`);
    console.log(`\n🚀 Feature "${feature.description.split('\\n')[0]}" has been added to Waddle!`);
    console.log(`\nThe architect will pick this up when you run Waddle in development mode.`);
    
    db.close();
  } catch (error) {
    console.error('❌ Error creating feature:', error);
    db.close();
    process.exit(1);
  }
}

createMCPFixFeature().catch(console.error);