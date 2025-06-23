#!/usr/bin/env tsx
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import { 
  createPattern, 
  createADR, 
  createReview,
  sendMessage,
  getPatternsByFilter,
  getADRsByWorkItem,
  getReviewsByWorkItem,
  getMessagesForAgent
} from '../src/database/knowledge.js';
import { defaultContextManager } from '../src/agents/context-manager.js';
import { accessControl } from '../src/api/middleware/access-control.js';
import { createWorkItem, updateWorkItemStatus } from '../src/database/utils.js';
import { addToWorkHistory } from '../src/database/work-history.js';
import { PatternType, ADRStatus, ReviewStatus, MessageType, MessagePriority } from '../src/types/knowledge.js';
import { AgentRole, WorkItemType, WorkItemStatus, Priority } from '../src/types/index.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'test-knowledge-query.db');
const TEST_DB_WAL = `${TEST_DB_PATH}-wal`;
const TEST_DB_SHM = `${TEST_DB_PATH}-shm`;

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`✅ ${message}`);
    passedTests++;
  } else {
    console.error(`❌ ${message}`);
    failedTests++;
  }
}

function cleanupTestDb() {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  if (existsSync(TEST_DB_WAL)) unlinkSync(TEST_DB_WAL);
  if (existsSync(TEST_DB_SHM)) unlinkSync(TEST_DB_SHM);
}

async function setupTestData() {
  // Create test work items
  const epicId = createWorkItem({
    title: 'Test Epic',
    description: 'Test epic for knowledge query',
    type: WorkItemType.EPIC,
    status: WorkItemStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    assigned_to: 'system'
  });

  const storyId = createWorkItem({
    title: 'Test Story',
    description: 'Test story for knowledge query',
    type: WorkItemType.STORY,
    status: WorkItemStatus.IN_PROGRESS,
    priority: Priority.MEDIUM,
    assigned_to: AgentRole.DEVELOPER,
    parent_id: epicId
  });

  // Add work history with decisions
  addToWorkHistory(storyId, 'decision', AgentRole.ARCHITECT, JSON.stringify({
    decision: 'Use microservices architecture',
    rationale: 'Better scalability and maintainability'
  }));

  addToWorkHistory(storyId, 'agent_output', AgentRole.DEVELOPER, JSON.stringify({
    status: 'completed',
    implementation: 'Implemented service A'
  }));

  addToWorkHistory(storyId, 'error', AgentRole.DEVELOPER, JSON.stringify({
    errorType: 'CompilationError',
    errorMessage: 'Type mismatch in service B'
  }));

  // Create patterns
  const pattern1Id = createPattern({
    agent_role: AgentRole.DEVELOPER,
    pattern_type: 'solution' as PatternType,
    context: 'When implementing microservices',
    solution: 'Use API gateway pattern for service coordination',
    effectiveness_score: 0.85,
    work_item_ids: [storyId],
    metadata: {
      tags: ['microservices', 'architecture'],
      category: 'design'
    }
  });

  const pattern2Id = createPattern({
    agent_role: AgentRole.SECURITY,
    pattern_type: 'error_handling' as PatternType,
    context: 'When handling authentication errors',
    solution: 'Implement JWT token refresh with secure storage of refresh tokens',
    effectiveness_score: 0.90,
    metadata: {
      tags: ['security', 'authentication', 'sensitive'],
      sensitive: true
    }
  });

  const pattern3Id = createPattern({
    agent_role: AgentRole.ARCHITECT,
    pattern_type: 'approach' as PatternType,
    context: 'When storing API keys and secrets',
    solution: 'Use environment variables and secure vault services, never commit to code',
    effectiveness_score: 0.95,
    metadata: {
      tags: ['security', 'secrets', 'api-keys'],
      sensitive: true
    }
  });

  // Create ADRs
  const adr1Id = createADR({
    title: 'Use Event-Driven Architecture',
    context: 'Need for real-time updates across services',
    decision: 'Implement event bus using RabbitMQ',
    consequences: 'Increased complexity but better decoupling',
    status: 'accepted' as ADRStatus,
    created_by: AgentRole.ARCHITECT,
    work_item_id: storyId
  });

  const adr2Id = createADR({
    title: 'Deprecate Legacy API',
    context: 'Old API has security vulnerabilities',
    decision: 'Migrate to new API v2',
    status: 'deprecated' as ADRStatus,
    created_by: AgentRole.ARCHITECT
  });

  // Create reviews
  createReview({
    work_item_id: storyId,
    reviewer_role: AgentRole.REVIEWER,
    review_type: 'code',
    status: 'approved' as ReviewStatus,
    feedback: 'Code follows best practices',
    quality_score: 0.85
  });

  createReview({
    work_item_id: storyId,
    reviewer_role: AgentRole.SECURITY,
    review_type: 'security',
    status: 'needs_revision' as ReviewStatus,
    feedback: 'Missing input validation',
    suggestions: 'Add input sanitization for user data',
    quality_score: 0.65
  });

  // Create messages
  sendMessage({
    from_agent: AgentRole.MANAGER,
    to_agent: AgentRole.DEVELOPER,
    message_type: 'request' as MessageType,
    priority: 'high' as MessagePriority,
    subject: 'Update on story progress',
    content: 'Please provide status update on the microservices implementation',
    work_item_id: storyId
  });

  sendMessage({
    from_agent: AgentRole.ARCHITECT,
    to_agent: AgentRole.DEVELOPER,
    message_type: 'notification' as MessageType,
    priority: 'medium' as MessagePriority,
    subject: 'Architecture changes',
    content: 'Updated the service discovery mechanism',
    work_item_id: storyId
  });

  return { epicId, storyId, pattern1Id, pattern2Id, pattern3Id, adr1Id, adr2Id };
}

async function testDecisionTracing(storyId: string) {
  console.log('\n📍 Testing Decision Tracing...');

  // Get work history
  const { getWorkItemHistory } = await import('../src/database/utils.js');
  const history = getWorkItemHistory(storyId);
  
  assert(history.length > 0, 'Should have work history');
  
  const decisions = history.filter(h => 
    h.action === 'decision' || 
    (h.action === 'agent_output' && h.content?.includes('decision'))
  );
  
  assert(decisions.length > 0, 'Should have decision entries');
  assert(decisions[0].content?.includes('microservices'), 'Decision should contain expected content');
}

async function testContextRetrieval(storyId: string) {
  console.log('\n📍 Testing Context Retrieval...');

  const context = await defaultContextManager.getContextForWorkItem(storyId);
  
  assert(context.workItemId === storyId, 'Context should have correct work item ID');
  assert(context.relevantHistory.length > 0, 'Should have relevant history');
  assert(context.successPatterns.length > 0, 'Should extract success patterns');
  assert(context.errorPatterns.length > 0, 'Should extract error patterns');
  assert(context.agentPerformance.size > 0, 'Should have agent performance metrics');
  
  // Test agent-specific context
  const agentContext = await defaultContextManager.getContextForAgent(AgentRole.DEVELOPER, storyId);
  assert(agentContext.includes('RELEVANT HISTORY'), 'Agent context should include history section');
  assert(agentContext.includes('SUCCESS PATTERNS'), 'Agent context should include success patterns');
}

async function testAccessControl() {
  console.log('\n📍 Testing Access Control...');

  // Get all patterns
  const allPatterns = getPatternsByFilter({});
  assert(allPatterns.length >= 3, 'Should have at least 3 patterns');

  // Test without access
  const filteredPatterns = accessControl.filterPatterns(allPatterns, undefined, false);
  const sensitivePattern = filteredPatterns.find(p => p.metadata?.includes('sensitive'));
  assert(
    sensitivePattern?.solution.includes('[REDACTED'),
    'Sensitive patterns should be redacted without proper access'
  );

  // Test with architect role
  const architectPatterns = accessControl.filterPatterns(allPatterns, 'architect', false);
  const architectSensitive = architectPatterns.find(p => p.metadata?.includes('sensitive'));
  assert(
    !architectSensitive?.solution.includes('[REDACTED'),
    'Architect role should see sensitive patterns'
  );

  // Test with API key
  const apiKeyPatterns = accessControl.filterPatterns(allPatterns, undefined, true);
  const apiKeySensitive = apiKeyPatterns.find(p => p.metadata?.includes('sensitive'));
  assert(
    !apiKeySensitive?.solution.includes('[REDACTED'),
    'Valid API key should allow access to sensitive patterns'
  );

  // Test pattern sensitivity detection
  const securityPattern = allPatterns.find(p => p.pattern_type === 'error_handling');
  if (securityPattern) {
    assert(
      accessControl.isPatternSensitive(securityPattern),
      'Security patterns should be detected as sensitive'
    );
  }
}

async function testPatternSearch() {
  console.log('\n📍 Testing Pattern Search...');

  // Test type filtering
  const solutionPatterns = getPatternsByFilter({ pattern_type: 'solution' as PatternType });
  assert(solutionPatterns.length >= 1, 'Should find solution patterns');
  assert(solutionPatterns.every(p => p.pattern_type === 'solution'), 'All patterns should be of type solution');

  // Test agent role filtering
  const developerPatterns = getPatternsByFilter({ agent_role: AgentRole.DEVELOPER });
  assert(developerPatterns.length >= 1, 'Should find developer patterns');
  assert(developerPatterns.every(p => p.agent_role === AgentRole.DEVELOPER), 'All patterns should be from developer');

  // Test effectiveness score filtering
  const highScorePatterns = getPatternsByFilter({ min_effectiveness_score: 0.9 });
  assert(highScorePatterns.length >= 1, 'Should find high-score patterns');
  assert(highScorePatterns.every(p => p.effectiveness_score >= 0.9), 'All patterns should have high effectiveness');
}

async function testADRQueries(storyId: string) {
  console.log('\n📍 Testing ADR Queries...');

  // Test by work item
  const workItemADRs = getADRsByWorkItem(storyId);
  assert(workItemADRs.length >= 1, 'Should find ADRs for work item');
  assert(workItemADRs[0].work_item_id === storyId, 'ADR should be linked to correct work item');

  // Test by status
  const acceptedADRs = getADRsByStatus('accepted' as ADRStatus);
  assert(acceptedADRs.length >= 1, 'Should find accepted ADRs');
  assert(acceptedADRs.every(a => a.status === 'accepted'), 'All ADRs should have accepted status');

  const deprecatedADRs = getADRsByStatus('deprecated' as ADRStatus);
  assert(deprecatedADRs.length >= 1, 'Should find deprecated ADRs');
}

async function testReviewQueries(storyId: string) {
  console.log('\n📍 Testing Review Queries...');

  const reviews = getReviewsByWorkItem(storyId);
  assert(reviews.length === 2, 'Should find 2 reviews for work item');
  
  const codeReview = reviews.find(r => r.review_type === 'code');
  assert(codeReview?.status === 'approved', 'Code review should be approved');
  
  const securityReview = reviews.find(r => r.review_type === 'security');
  assert(securityReview?.status === 'needs_revision', 'Security review should need revision');
  assert(securityReview?.suggestions !== null, 'Security review should have suggestions');
}

async function testMessageQueries() {
  console.log('\n📍 Testing Message Queries...');

  const developerMessages = getMessagesForAgent(AgentRole.DEVELOPER);
  assert(developerMessages.length === 2, 'Developer should have 2 messages');
  
  const highPriorityMessage = developerMessages.find(m => m.priority === 'high');
  assert(highPriorityMessage !== undefined, 'Should find high priority message');
  assert(highPriorityMessage.from_agent === AgentRole.MANAGER, 'High priority message should be from manager');
}

async function runTests() {
  console.log('🧪 Starting Knowledge Query Tests...\n');

  try {
    // Setup
    cleanupTestDb();
    process.env.WADDLE_DB_PATH = TEST_DB_PATH;
    initializeDatabase();

    const { storyId } = await setupTestData();

    // Run tests
    await testDecisionTracing(storyId);
    await testContextRetrieval(storyId);
    await testAccessControl();
    await testPatternSearch();
    await testADRQueries(storyId);
    await testReviewQueries(storyId);
    await testMessageQueries();

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(`   Total:  ${passedTests + failedTests}`);

    if (failedTests === 0) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n❌ Some tests failed!');
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    closeDatabase();
    cleanupTestDb();
  }
}

// Run tests
runTests();