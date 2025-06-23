import { initializeDatabase, closeDatabase, getDatabase } from '../src/database/connection.js';
import {
  createPattern,
  getPattern,
  getPatternsByFilter,
  updatePatternEffectiveness,
  incrementPatternUsage,
  createADR,
  getADR,
  getADRsByStatus,
  getADRsByWorkItem,
  updateADRStatus,
  createReview,
  getReview,
  getReviewsByWorkItem,
  getReviewsByStatus,
  sendMessage,
  getMessage,
  getMessagesForAgent,
  updateMessageStatus
} from '../src/database/knowledge.js';
import { createWorkItem } from '../src/database/utils.js';
import { PatternType, ADRStatus, ReviewStatus, MessageStatus } from '../src/types/knowledge.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting knowledge base tests...\n');
  
  const testDbPath = path.join(__dirname, 'test-knowledge.db');
  
  // Clean up any existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(testDbPath + '-wal')) {
    fs.unlinkSync(testDbPath + '-wal');
  }
  if (fs.existsSync(testDbPath + '-shm')) {
    fs.unlinkSync(testDbPath + '-shm');
  }
  
  try {
    // Initialize test database
    initializeDatabase(testDbPath);
    console.log('✅ Database initialized\n');
    
    // Test Pattern CRUD operations
    console.log('📚 Testing Pattern operations...');
    
    // Create a pattern
    const pattern1 = createPattern({
      agent_role: 'developer',
      pattern_type: 'solution',
      context: 'When implementing REST API endpoints',
      solution: 'Use Express middleware for consistent error handling',
      effectiveness_score: 0.85,
      work_item_ids: ['TASK-123', 'TASK-456'],
      metadata: {
        tags: ['api', 'error-handling', 'express'],
        category: 'backend'
      }
    });
    
    assert(pattern1.id.startsWith('PATTERN-'), 'Pattern ID should start with PATTERN-');
    assert(pattern1.agent_role === 'developer', 'Agent role should be developer');
    assert(pattern1.effectiveness_score === 0.85, 'Effectiveness score should be 0.85');
    assert(pattern1.usage_count === 0, 'Initial usage count should be 0');
    
    // Retrieve pattern
    const retrievedPattern = getPattern(pattern1.id);
    assert(retrievedPattern !== null, 'Should retrieve pattern');
    assert(retrievedPattern!.context === pattern1.context, 'Context should match');
    
    // Create more patterns for filtering
    const pattern2 = createPattern({
      agent_role: 'architect',
      pattern_type: 'approach',
      context: 'When designing microservices',
      solution: 'Use event-driven architecture for loose coupling',
      effectiveness_score: 0.92
    });
    
    const pattern3 = createPattern({
      agent_role: 'developer',
      pattern_type: 'error_handling',
      context: 'When handling database errors',
      solution: 'Implement retry logic with exponential backoff',
      effectiveness_score: 0.78
    });
    
    // Test filtering by agent role
    const developerPatterns = getPatternsByFilter({ agent_role: 'developer' });
    assert(developerPatterns.length === 2, 'Should find 2 developer patterns');
    
    // Test filtering by pattern type
    const solutionPatterns = getPatternsByFilter({ pattern_type: 'solution' });
    assert(solutionPatterns.length === 1, 'Should find 1 solution pattern');
    
    // Test filtering by effectiveness score
    const highQualityPatterns = getPatternsByFilter({ min_effectiveness_score: 0.8 });
    assert(highQualityPatterns.length === 2, 'Should find 2 patterns with score >= 0.8');
    
    // Test limiting results
    const limitedPatterns = getPatternsByFilter({ max_results: 2 });
    assert(limitedPatterns.length === 2, 'Should return at most 2 patterns');
    
    // Test pattern effectiveness update
    const updated = updatePatternEffectiveness(pattern1.id, 0.90, true);
    assert(updated === true, 'Should update pattern effectiveness');
    
    const updatedPattern = getPattern(pattern1.id);
    assert(updatedPattern!.effectiveness_score === 0.90, 'Effectiveness score should be updated');
    assert(updatedPattern!.usage_count === 1, 'Usage count should be incremented');
    
    // Test usage increment
    incrementPatternUsage(pattern1.id);
    const patternAfterIncrement = getPattern(pattern1.id);
    assert(patternAfterIncrement!.usage_count === 2, 'Usage count should be 2');
    
    console.log('\n📋 Testing ADR operations...');
    
    // Create a work item for ADR testing
    const workItem = createWorkItem('EPIC-TEST-1', 'epic', 'Test Epic', 'Testing ADRs');
    
    // Create an ADR
    const adr1 = createADR({
      title: 'Use TypeScript for type safety',
      context: 'Team needs better type checking and IDE support',
      decision: 'Adopt TypeScript for all new development',
      consequences: 'Learning curve for team, better maintainability',
      status: 'accepted',
      work_item_id: workItem.id,
      created_by: 'architect-1'
    });
    
    assert(adr1.id.startsWith('ADR-'), 'ADR ID should start with ADR-');
    assert(adr1.status === 'accepted', 'ADR status should be accepted');
    
    // Retrieve ADR
    const retrievedADR = getADR(adr1.id);
    assert(retrievedADR !== null, 'Should retrieve ADR');
    assert(retrievedADR!.title === adr1.title, 'Title should match');
    
    // Create more ADRs
    const adr2 = createADR({
      title: 'Use MongoDB for data storage',
      context: 'Need flexible schema for rapid development',
      decision: 'Use MongoDB as primary database',
      status: 'proposed',
      created_by: 'architect-2'
    });
    
    const adr3 = createADR({
      title: 'Use PostgreSQL for data storage',
      context: 'Need ACID compliance and complex queries',
      decision: 'Use PostgreSQL as primary database',
      status: 'accepted',
      work_item_id: workItem.id,
      created_by: 'architect-1'
    });
    
    // Test filtering by status
    const acceptedADRs = getADRsByStatus('accepted');
    assert(acceptedADRs.length === 2, 'Should find 2 accepted ADRs');
    
    const proposedADRs = getADRsByStatus('proposed');
    assert(proposedADRs.length === 1, 'Should find 1 proposed ADR');
    
    // Test filtering by work item
    const workItemADRs = getADRsByWorkItem(workItem.id);
    assert(workItemADRs.length === 2, 'Should find 2 ADRs for work item');
    
    // Test ADR status update with supersession
    const statusUpdated = updateADRStatus(adr2.id, 'superseded', adr3.id);
    assert(statusUpdated === true, 'Should update ADR status');
    
    const supersededADR = getADR(adr2.id);
    assert(supersededADR!.status === 'superseded', 'ADR should be superseded');
    assert(supersededADR!.superseded_by === adr3.id, 'Should reference superseding ADR');
    
    console.log('\n✍️ Testing Review operations...');
    
    // Create a review
    const review1 = createReview({
      work_item_id: workItem.id,
      reviewer_role: 'reviewer',
      review_type: 'architecture',
      status: 'approved',
      feedback: 'Well-designed architecture with clear separation of concerns',
      suggestions: 'Consider adding more detailed error handling specs',
      quality_score: 0.88
    });
    
    assert(review1.id.startsWith('REVIEW-'), 'Review ID should start with REVIEW-');
    assert(review1.status === 'approved', 'Review status should be approved');
    assert(review1.quality_score === 0.88, 'Quality score should be 0.88');
    
    // Retrieve review
    const retrievedReview = getReview(review1.id);
    assert(retrievedReview !== null, 'Should retrieve review');
    assert(retrievedReview!.feedback === review1.feedback, 'Feedback should match');
    
    // Create more reviews
    const review2 = createReview({
      work_item_id: workItem.id,
      reviewer_role: 'developer',
      review_type: 'code',
      status: 'needs_changes',
      feedback: 'Code needs refactoring for better readability',
      suggestions: 'Extract complex logic into separate functions'
    });
    
    // Test filtering by work item
    const workItemReviews = getReviewsByWorkItem(workItem.id);
    assert(workItemReviews.length === 2, 'Should find 2 reviews for work item');
    
    // Test filtering by status
    const approvedReviews = getReviewsByStatus('approved');
    assert(approvedReviews.length === 1, 'Should find 1 approved review');
    
    const needsChangesReviews = getReviewsByStatus('needs_changes');
    assert(needsChangesReviews.length === 1, 'Should find 1 needs_changes review');
    
    console.log('\n💬 Testing Agent Communication operations...');
    
    // Send a message
    const message1 = sendMessage({
      from_agent: 'manager-1',
      to_agent: 'developer-1',
      message_type: 'request',
      subject: 'Please implement user authentication',
      content: 'We need to add JWT-based authentication to the API',
      work_item_id: workItem.id,
      priority: 'high'
    });
    
    assert(message1.id.startsWith('MSG-'), 'Message ID should start with MSG-');
    assert(message1.status === 'pending', 'Initial message status should be pending');
    assert(message1.priority === 'high', 'Message priority should be high');
    
    // Retrieve message
    const retrievedMessage = getMessage(message1.id);
    assert(retrievedMessage !== null, 'Should retrieve message');
    assert(retrievedMessage!.subject === message1.subject, 'Subject should match');
    
    // Send more messages
    const message2 = sendMessage({
      from_agent: 'developer-1',
      to_agent: 'reviewer-1',
      message_type: 'notification',
      subject: 'Code ready for review',
      content: 'Authentication implementation is complete and ready for review',
      priority: 'medium'
    });
    
    const message3 = sendMessage({
      from_agent: 'architect-1',
      to_agent: 'developer-1',
      message_type: 'query',
      subject: 'Database schema question',
      content: 'Should we use UUID or auto-increment for primary keys?',
      priority: 'low'
    });
    
    // Test getting messages for agent
    const developerMessages = getMessagesForAgent('developer-1');
    assert(developerMessages.length === 2, 'Developer should have 2 messages');
    
    // Test filtering by status
    const pendingMessages = getMessagesForAgent('developer-1', 'pending');
    assert(pendingMessages.length === 2, 'Should find 2 pending messages');
    
    // Test message ordering (urgent > high > medium > low)
    assert(developerMessages[0].priority === 'high', 'High priority message should be first');
    assert(developerMessages[1].priority === 'low', 'Low priority message should be last');
    
    // Test updating message status
    let statusUpdateResult = updateMessageStatus(message1.id, 'delivered', 'delivered_at');
    assert(statusUpdateResult === true, 'Should update message status to delivered');
    
    statusUpdateResult = updateMessageStatus(message1.id, 'read', 'read_at');
    assert(statusUpdateResult === true, 'Should update message status to read');
    
    statusUpdateResult = updateMessageStatus(message1.id, 'processed', 'processed_at');
    assert(statusUpdateResult === true, 'Should update message status to processed');
    
    const processedMessage = getMessage(message1.id);
    assert(processedMessage!.status === 'processed', 'Message should be processed');
    assert(processedMessage!.delivered_at !== null, 'Should have delivered timestamp');
    assert(processedMessage!.read_at !== null, 'Should have read timestamp');
    assert(processedMessage!.processed_at !== null, 'Should have processed timestamp');
    
    // Verify no embeddings are returned by default
    const patternsWithoutEmbeddings = getPatternsByFilter({});
    assert(
      patternsWithoutEmbeddings.every(p => p.embedding === null),
      'Patterns should not include embeddings by default'
    );
    
    console.log('\n📊 Test Summary:');
    console.log(`Total tests: ${testsPassed + testsFailed}`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    
    if (testsFailed === 0) {
      console.log('\n✨ All tests passed!');
    } else {
      console.error(`\n❌ ${testsFailed} tests failed`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  } finally {
    closeDatabase();
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDbPath + '-wal')) {
      fs.unlinkSync(testDbPath + '-wal');
    }
    if (fs.existsSync(testDbPath + '-shm')) {
      fs.unlinkSync(testDbPath + '-shm');
    }
  }
}

runTests().catch(console.error);