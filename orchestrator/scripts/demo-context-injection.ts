#!/usr/bin/env node

import { initializeDatabase } from '../src/database/connection.js';
import { createWorkItem, addHistory, getWorkItem, generateId } from '../src/database/utils.js';
import { ContextManager } from '../src/agents/context-manager.js';
import { RelevanceScorer } from '../src/agents/relevance-scorer.js';
import { ABTestingManager, getABTestingManager } from '../src/agents/ab-testing.js';
import { buildManagerPrompt, buildArchitectPrompt, PromptConfig } from '../src/agents/prompts.js';
import { closeDatabase } from '../src/database/connection.js';
import { OrchestratorConfig } from '../src/orchestrator/config.js';

async function demonstrateContextInjection() {
  console.log('🚀 Demonstrating Historical Context Injection Feature\n');
  
  // Initialize database
  const dbPath = './orchestrator.db';
  initializeDatabase(dbPath);
  
  try {
    // Create sample work items with history
    console.log('📝 Creating sample work items with rich history...\n');
    
    // Create an epic with history
    const epicId = generateId('EPIC');
    createWorkItem(epicId, 'epic', 
      'Implement Real-time Collaboration Features',
      'Add WebSocket-based real-time collaboration capabilities to the platform'
    );
    
    // Add some history
    addHistory(epicId, 'status_change', JSON.stringify({ from: 'backlog', to: 'ready' }), 'manager');
    addHistory(epicId, 'agent_output', JSON.stringify({
      technicalApproach: 'Use Socket.io for WebSocket implementation with Redis pub/sub for scaling',
      risks: ['Potential scaling issues', 'Complex state synchronization'],
      dependencies: ['Redis', 'Socket.io']
    }), 'architect');
    
    // Create a story with history
    const storyId = generateId('STORY');
    createWorkItem(storyId, 'story',
      'As a user, I want to see real-time cursor positions of other users',
      'Implement real-time cursor tracking and display for collaborative editing',
      epicId,
      'in_progress'
    );
    
    addHistory(storyId, 'agent_output', JSON.stringify({
      status: 'completed',
      implementationNotes: 'Implemented cursor tracking with throttled updates',
      filesChanged: ['src/collaboration/cursor-tracker.ts', 'src/websocket/handlers.ts']
    }), 'developer');
    
    // Create a bug with error history
    const bugId = generateId('BUG');
    createWorkItem(bugId, 'bug',
      'Cursor positions lag in high-latency environments',
      'Users report significant cursor position lag when network latency exceeds 200ms',
      storyId,
      'ready'
    );
    
    addHistory(bugId, 'error', JSON.stringify({
      errorType: 'PERFORMANCE_ERROR',
      errorMessage: 'Update throttling too aggressive for high-latency connections',
      agentType: 'developer'
    }), 'bug-buster');
    
    console.log('✅ Sample data created\n');
    
    // Demonstrate context retrieval
    console.log('🔍 Retrieving historical context...\n');
    
    const contextManager = new ContextManager({
      maxHistoryItems: 10,
      maxRelatedItems: 5,
      enableCaching: true
    });
    
    // Get context for the bug
    const bugContext = await contextManager.getContextForWorkItem(bugId);
    console.log(`📋 Context for bug ${bugId}:`);
    console.log(`   - Related items: ${bugContext.relatedItems.length}`);
    console.log(`   - Relevant history entries: ${bugContext.relevantHistory.length}`);
    console.log(`   - Error patterns: ${bugContext.errorPatterns.join(', ')}`);
    console.log(`   - Success patterns: ${bugContext.successPatterns.join(', ')}`);
    
    // Get agent-specific context
    const developerContext = await contextManager.getContextForAgent('developer', bugId);
    console.log('\n📝 Developer-specific context preview:');
    console.log(developerContext.substring(0, 500) + '...\n');
    
    // Demonstrate relevance scoring
    console.log('⚖️  Demonstrating relevance scoring...\n');
    
    const scorer = new RelevanceScorer();
    const scoredHistory = scorer.scoreHistory(
      bugContext.relevantHistory,
      getWorkItem(bugId)!,
      'developer',
      [epicId, storyId]
    );
    
    console.log('Top 3 most relevant history items:');
    scoredHistory
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .forEach((item, index) => {
        console.log(`   ${index + 1}. Score: ${item.score.toFixed(1)} - ${item.item.action} by ${item.item.created_by}`);
        console.log(`      Reasons: ${item.reasons.join(', ')}`);
      });
    
    // Demonstrate A/B testing
    console.log('\n🔬 Demonstrating A/B testing...\n');
    
    const config: OrchestratorConfig = {
      pollingInterval: 5000,
      claudeExecutable: 'claude',
      workingDirectory: '.',
      database: dbPath,
      agents: {
        manager: { model: 'claude-3-sonnet' },
        architect: { model: 'claude-3-sonnet' },
        developer: { model: 'claude-3-sonnet' }
      },
      enableHistoricalContext: true,
      abTesting: {
        enabled: true,
        contextEnabledPercent: 60, // 60% get context
        seed: 42
      }
    };
    
    const abManager = getABTestingManager(config);
    
    // Test A/B assignments
    console.log('A/B Test Assignments:');
    for (let i = 0; i < 5; i++) {
      const workItemId = `TEST-${i}`;
      const result = abManager.shouldEnableContext(workItemId, 'developer');
      console.log(`   ${workItemId}: ${result.variant} (context: ${result.enableContext})`);
    }
    
    // Simulate some metrics
    console.log('\n📊 Simulating A/B test metrics...\n');
    
    for (let i = 0; i < 20; i++) {
      const variant = i % 2 === 0 ? 'control' : 'treatment';
      const success = Math.random() > 0.2; // 80% success rate
      
      abManager.recordMetrics({
        variant,
        workItemId: `SIM-${i}`,
        agentType: 'developer',
        executionTimeMs: 1000 + Math.random() * 2000,
        success,
        errorType: success ? undefined : 'timeout',
        contextSize: variant === 'treatment' ? 1500 + Math.random() * 1000 : undefined,
        timestamp: new Date()
      });
    }
    
    // Generate report
    const report = abManager.generateReport();
    console.log(report);
    
    // Demonstrate prompt building with context
    console.log('\n🏗️  Demonstrating prompt building with context...\n');
    
    const promptConfig: PromptConfig = {
      enableHistoricalContext: true,
      maxContextLength: 1000,
      contextManager
    };
    
    // Build architect prompt with context
    const epic = getWorkItem(epicId)!;
    const architectPrompt = await buildArchitectPrompt(epic, promptConfig);
    
    console.log('Architect prompt preview (first 800 chars):');
    console.log('---');
    console.log(architectPrompt.substring(0, 800) + '...');
    console.log('---\n');
    
    // Show context injection
    if (architectPrompt.includes('HISTORICAL CONTEXT:')) {
      const contextStart = architectPrompt.indexOf('HISTORICAL CONTEXT:');
      const contextEnd = architectPrompt.indexOf('\n\nYour responsibilities:', contextStart);
      const contextSection = architectPrompt.substring(contextStart, contextEnd);
      
      console.log('✨ Injected historical context:');
      console.log('---');
      console.log(contextSection);
      console.log('---');
    }
    
  } finally {
    closeDatabase();
    console.log('\n✅ Demo completed!');
  }
}

// Run the demo
demonstrateContextInjection().catch(console.error);