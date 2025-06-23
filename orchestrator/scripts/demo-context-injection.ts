#!/usr/bin/env tsx

/**
 * Demo script to showcase the new historical context injection system
 */

import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import {
  createPattern,
  createADR,
  createReview,
  getPatternsByFilter,
  getADRsByStatus
} from '../src/database/knowledge.js';
import { ContextRetrievalService } from '../src/services/context-retrieval.js';
import { EnhancedPromptBuilder } from '../src/agents/prompts-enhanced.js';
import { ABTestingService } from '../src/services/ab-testing.js';
import { ContextCache } from '../src/services/context-cache.js';
import { WorkItem } from '../src/types/index.js';
import { getLogger } from '../src/utils/logger.js';

const logger = getLogger();

async function seedKnowledgeBase() {
  logger.info('Seeding knowledge base with sample data...');

  // Add patterns
  const patterns = [
    {
      agent_role: 'developer' as const,
      pattern_type: 'solution' as const,
      context: 'When implementing JWT authentication in Node.js applications',
      solution: 'Use jsonwebtoken library with RS256 algorithm for better security. Store public keys in environment variables.',
      effectiveness_score: 0.92,
      work_item_ids: ['STORY-AUTH-001', 'STORY-AUTH-002']
    },
    {
      agent_role: 'developer' as const,
      pattern_type: 'error_handling' as const,
      context: 'Handling database connection timeouts in production',
      solution: 'Implement exponential backoff with jitter. Max 3 retries with delays of 1s, 2s, 4s.',
      effectiveness_score: 0.88,
      work_item_ids: ['BUG-DB-001']
    },
    {
      agent_role: 'reviewer' as const,
      pattern_type: 'approach' as const,
      context: 'Reviewing authentication implementations',
      solution: 'Check for: secure token storage, proper validation, refresh token rotation, and rate limiting.',
      effectiveness_score: 0.95,
      work_item_ids: ['STORY-AUTH-001']
    },
    {
      agent_role: 'architect' as const,
      pattern_type: 'solution' as const,
      context: 'Designing scalable microservices architecture',
      solution: 'Use event-driven architecture with message queues. Implement circuit breakers and service mesh.',
      effectiveness_score: 0.87
    }
  ];

  for (const pattern of patterns) {
    createPattern(pattern);
  }

  // Add ADRs
  const adrs = [
    {
      title: 'Use JWT for API Authentication',
      context: 'Need stateless authentication for distributed system',
      decision: 'Implement JWT with RS256 algorithm. Tokens expire after 1 hour.',
      consequences: 'Requires key rotation strategy. No server-side session storage needed.',
      status: 'accepted' as const,
      created_by: 'architect'
    },
    {
      title: 'Adopt Event Sourcing for Audit Trail',
      context: 'Regulatory requirement for complete audit history',
      decision: 'Use event sourcing pattern with immutable event store',
      consequences: 'Increased storage requirements. Complex event replay logic.',
      status: 'accepted' as const,
      created_by: 'architect'
    }
  ];

  for (const adr of adrs) {
    createADR(adr);
  }

  // Note: We're not adding reviews here because they require existing work items
  // In a real system, reviews would be created after actual work items exist

  logger.info('Knowledge base seeded successfully');
}

async function demonstrateContextRetrieval() {
  logger.info('\n=== Demonstrating Context Retrieval ===\n');

  const contextService = new ContextRetrievalService();

  // Example 1: Developer working on authentication
  const authContext = {
    currentTask: 'Implement user authentication with JWT tokens',
    agentRole: 'developer' as const,
    workItemType: 'story' as const,
    workItemId: 'STORY-NEW-AUTH'
  };

  logger.info('Retrieving context for authentication task...');
  const authResults = contextService.retrieveRelevantContext(authContext, {
    maxResults: 5,
    minRelevanceScore: 0.3
  });

  logger.info(`Found ${authResults.patterns.length} patterns, ${authResults.adrs.length} ADRs`);
  
  const formattedContext = contextService.formatContextForPrompt(authResults);
  console.log('\nFormatted Context:');
  console.log(formattedContext);

  // Example 2: Architect designing microservices
  const archContext = {
    currentTask: 'Design scalable architecture for payment processing',
    agentRole: 'architect' as const,
    workItemType: 'epic' as const,
    workItemId: 'EPIC-PAYMENTS'
  };

  logger.info('\nRetrieving context for architecture task...');
  const archResults = contextService.retrieveRelevantContext(archContext, {
    maxResults: 5,
    minRelevanceScore: 0.2
  });

  logger.info(`Found ${archResults.patterns.length} patterns, ${archResults.adrs.length} ADRs`);
}

async function demonstrateEnhancedPrompts() {
  logger.info('\n=== Demonstrating Enhanced Prompt Building ===\n');

  const promptBuilder = new EnhancedPromptBuilder({
    enableKnowledgeBase: true,
    maxContextLength: 2000
  });

  const workItem: WorkItem = {
    id: 'STORY-DEMO-001',
    type: 'story',
    title: 'Add JWT refresh token functionality',
    description: 'Implement refresh token rotation for better security',
    status: 'ready',
    parent_id: null,
    assigned_role: 'developer',
    processing_started_at: null,
    processing_agent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  logger.info('Building developer prompt with historical context...');
  const prompt = await promptBuilder.buildDeveloperPrompt(
    workItem, 
    'Previous implementation uses JWT. Need to add refresh token support.'
  );

  console.log('\nEnhanced Developer Prompt (first 1000 chars):');
  console.log(prompt.substring(0, 1000) + '...\n');
}

async function demonstrateCaching() {
  logger.info('\n=== Demonstrating Context Caching ===\n');

  const cache = new ContextCache({
    maxSize: 100,
    ttlMinutes: 15
  });

  // Simulate multiple context retrievals
  const contextService = new ContextRetrievalService();

  const context = {
    currentTask: 'Implement API rate limiting',
    agentRole: 'developer' as const,
    workItemType: 'story' as const,
    workItemId: 'STORY-RATE-LIMIT'
  };

  logger.info('First retrieval (cache miss expected)...');
  let start = Date.now();
  contextService.retrieveRelevantContext(context);
  let duration = Date.now() - start;
  logger.info(`Retrieval took ${duration}ms`);

  logger.info('Second retrieval (cache hit expected)...');
  start = Date.now();
  contextService.retrieveRelevantContext(context);
  duration = Date.now() - start;
  logger.info(`Retrieval took ${duration}ms (should be faster)`);

  const stats = contextService.getCacheStats();
  logger.info('Cache statistics:', stats);
}

async function demonstrateABTesting() {
  logger.info('\n=== Demonstrating A/B Testing ===\n');

  const abService = new ABTestingService({
    enabled: true,
    contextEnabledPercent: 50,
    seed: 12345
  });

  // Simulate processing multiple work items
  const workItemIds = ['STORY-001', 'STORY-002', 'STORY-003', 'STORY-004', 'STORY-005'];

  for (const id of workItemIds) {
    const variant = abService.getVariant('developer', id);
    logger.info(`Work item ${id} assigned to ${variant.variant} group (context: ${variant.enableContext})`);

    // Simulate execution metrics
    abService.recordMetrics({
      variant: variant.variant,
      agentRole: 'developer',
      workItemId: id,
      executionTimeMs: variant.enableContext ? 1500 + Math.random() * 500 : 1000 + Math.random() * 500,
      success: Math.random() > 0.2,
      contextSize: variant.enableContext ? 2000 + Math.random() * 1000 : undefined,
      timestamp: new Date()
    });
  }

  // Generate report
  const report = abService.generateReport();
  console.log('\nA/B Test Report:');
  console.log(report);
}

async function main() {
  try {
    // Initialize database
    initializeDatabase('./demo-context.db');

    // Seed knowledge base
    await seedKnowledgeBase();

    // Run demonstrations
    await demonstrateContextRetrieval();
    await demonstrateEnhancedPrompts();
    await demonstrateCaching();
    await demonstrateABTesting();

    // Show summary statistics
    logger.info('\n=== Summary Statistics ===\n');
    
    const patterns = getPatternsByFilter({});
    const adrs = getADRsByStatus('accepted');
    
    logger.info(`Knowledge Base Contents:`);
    logger.info(`- Patterns: ${patterns.length}`);
    logger.info(`- ADRs: ${adrs.length}`);

  } catch (error) {
    logger.error('Demo failed:', error);
  } finally {
    closeDatabase();
    
    // Clean up demo database
    const fs = await import('fs');
    if (fs.existsSync('./demo-context.db')) {
      fs.unlinkSync('./demo-context.db');
    }
  }
}

// Run the demo
main().catch(console.error);