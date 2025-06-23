#!/usr/bin/env tsx
import { createApiServer } from '../src/api/server.js';
import { initializeDatabase, closeDatabase } from '../src/database/connection.js';
import { 
  createPattern, 
  createADR, 
  createReview,
  sendMessage
} from '../src/database/knowledge.js';
import { createWorkItem } from '../src/database/utils.js';
import { addToWorkHistory } from '../src/database/work-history.js';
import { PatternType, ADRStatus, ReviewStatus, MessageType, MessagePriority } from '../src/types/knowledge.js';
import { AgentRole, WorkItemType, WorkItemStatus, Priority } from '../src/types/index.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'test-api-endpoints.db');
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

async function makeRequest(path: string, options: any = {}) {
  const app = createApiServer();
  const { default: request } = await import('supertest');
  return request(app).get(path).set(options.headers || {});
}

async function makePostRequest(path: string, body: any, options: any = {}) {
  const app = createApiServer();
  const { default: request } = await import('supertest');
  return request(app).post(path).send(body).set(options.headers || {});
}

async function makePutRequest(path: string, body: any, options: any = {}) {
  const app = createApiServer();
  const { default: request } = await import('supertest');
  return request(app).put(path).send(body).set(options.headers || {});
}

async function setupTestData() {
  const storyId = createWorkItem({
    title: 'API Test Story',
    description: 'Story for API testing',
    type: WorkItemType.STORY,
    status: WorkItemStatus.IN_PROGRESS,
    priority: Priority.MEDIUM,
    assigned_to: AgentRole.DEVELOPER
  });

  // Add decision history
  addToWorkHistory(storyId, 'decision', AgentRole.ARCHITECT, JSON.stringify({
    decision: 'Use REST API',
    rationale: 'Simplicity and wide support'
  }));

  // Create test patterns
  const pattern1 = createPattern({
    agent_role: AgentRole.DEVELOPER,
    pattern_type: 'solution' as PatternType,
    context: 'REST API implementation',
    solution: 'Use OpenAPI specification',
    effectiveness_score: 0.85,
    metadata: {
      tags: ['api', 'rest']
    }
  });

  const sensitivePattern = createPattern({
    agent_role: AgentRole.SECURITY,
    pattern_type: 'error_handling' as PatternType,
    context: 'API key management',
    solution: 'Store API keys in secure vault with rotation',
    effectiveness_score: 0.95,
    metadata: {
      tags: ['security', 'api-keys', 'sensitive'],
      sensitive: true
    }
  });

  // Create ADR
  const adr = createADR({
    title: 'API Versioning Strategy',
    context: 'Need for backward compatibility',
    decision: 'Use URL versioning (/v1, /v2)',
    status: 'accepted' as ADRStatus,
    created_by: AgentRole.ARCHITECT,
    work_item_id: storyId
  });

  // Create review
  createReview({
    work_item_id: storyId,
    reviewer_role: AgentRole.REVIEWER,
    review_type: 'code',
    status: 'approved' as ReviewStatus,
    feedback: 'API design follows REST principles',
    quality_score: 0.9
  });

  // Create message
  sendMessage({
    from_agent: AgentRole.MANAGER,
    to_agent: AgentRole.DEVELOPER,
    message_type: 'request' as MessageType,
    priority: 'high' as MessagePriority,
    subject: 'API documentation',
    content: 'Please update API docs',
    work_item_id: storyId
  });

  return { storyId, pattern1, sensitivePattern, adr };
}

async function testPatternEndpoints() {
  console.log('\n📍 Testing Pattern Endpoints...');

  // Test GET /api/patterns
  const response = await makeRequest('/api/patterns');
  assert(response.status === 200, 'Should return 200 for pattern search');
  assert(response.body.success === true, 'Should have success flag');
  assert(Array.isArray(response.body.patterns), 'Should return array of patterns');
  assert(response.body.count >= 2, 'Should have at least 2 patterns');

  // Test filtering
  const devPatterns = await makeRequest('/api/patterns?agent_role=developer');
  assert(devPatterns.body.patterns.every((p: any) => p.agent_role === 'developer'), 
    'Should filter by agent role');

  // Test search
  const searchResults = await makeRequest('/api/patterns?search=REST');
  assert(searchResults.body.patterns.length >= 1, 'Should find patterns by search term');

  // Test access control - sensitive pattern without auth
  const noAuthResponse = await makeRequest('/api/patterns?search=API%20key');
  const sensitivePattern = noAuthResponse.body.patterns.find((p: any) => 
    p.metadata && JSON.parse(p.metadata).sensitive
  );
  assert(sensitivePattern?.solution.includes('[REDACTED'), 
    'Sensitive patterns should be redacted without auth');

  // Test with role header
  const roleResponse = await makeRequest('/api/patterns', {
    headers: { 'x-user-role': 'architect' }
  });
  const rolePattern = roleResponse.body.patterns.find((p: any) => 
    p.metadata && JSON.parse(p.metadata).sensitive
  );
  assert(!rolePattern?.solution.includes('[REDACTED'), 
    'Architect role should see sensitive patterns');

  // Test GET /api/patterns/:id
  const firstPattern = response.body.patterns[0];
  const singlePattern = await makeRequest(`/api/patterns/${firstPattern.id}`);
  assert(singlePattern.status === 200, 'Should get pattern by ID');
  assert(singlePattern.body.pattern.id === firstPattern.id, 'Should return correct pattern');

  // Test pattern usage increment
  const usageResponse = await makePostRequest(`/api/patterns/${firstPattern.id}/use`, {});
  assert(usageResponse.status === 200, 'Should increment pattern usage');

  // Test pattern effectiveness update
  const effectivenessResponse = await makePutRequest(
    `/api/patterns/${firstPattern.id}/effectiveness`,
    { score: 0.95 }
  );
  assert(effectivenessResponse.status === 200, 'Should update pattern effectiveness');

  // Test access control status
  const statusResponse = await makeRequest('/api/patterns/access/status');
  assert(statusResponse.status === 200, 'Should get access control status');
  assert(statusResponse.body.access_control.enabled !== undefined, 'Should have enabled flag');
}

async function testDecisionEndpoints(storyId: string) {
  console.log('\n📍 Testing Decision Endpoints...');

  // Test GET /api/decisions/:id/trace
  const traceResponse = await makeRequest(`/api/decisions/${storyId}/trace`);
  assert(traceResponse.status === 200, 'Should return 200 for decision trace');
  assert(traceResponse.body.success === true, 'Should have success flag');
  assert(traceResponse.body.trace.work_item.id === storyId, 'Should have correct work item');
  assert(traceResponse.body.trace.decision_timeline.length >= 1, 'Should have decision timeline');
  assert(traceResponse.body.trace.influencing_context !== undefined, 'Should have influencing context');

  // Test GET /api/decisions/:id/context
  const contextResponse = await makeRequest(`/api/decisions/${storyId}/context`);
  assert(contextResponse.status === 200, 'Should return 200 for context');
  assert(contextResponse.body.context.work_item_id === storyId, 'Should have correct work item ID');
  assert(Array.isArray(contextResponse.body.context.relevant_history), 'Should have relevant history');
  assert(Array.isArray(contextResponse.body.context.success_patterns), 'Should have success patterns');

  // Test with include_details
  const detailedContext = await makeRequest(`/api/decisions/${storyId}/context?include_details=true`);
  assert(detailedContext.body.context.relevant_history[0]?.content !== undefined, 
    'Should include full history details when requested');

  // Test non-existent work item
  const notFoundResponse = await makeRequest('/api/decisions/INVALID-ID/trace');
  assert(notFoundResponse.status === 404, 'Should return 404 for non-existent work item');
}

async function testADREndpoints(storyId: string) {
  console.log('\n📍 Testing ADR Endpoints...');

  // Test GET /api/adrs
  const adrsResponse = await makeRequest('/api/adrs');
  assert(adrsResponse.status === 200, 'Should return 200 for ADR search');
  assert(Array.isArray(adrsResponse.body.adrs), 'Should return array of ADRs');

  // Test filtering by work item
  const workItemADRs = await makeRequest(`/api/adrs?work_item=${storyId}`);
  assert(workItemADRs.body.adrs.length >= 1, 'Should find ADRs for work item');
  assert(workItemADRs.body.adrs[0].work_item_id === storyId, 'ADR should be linked to work item');

  // Test filtering by status
  const acceptedADRs = await makeRequest('/api/adrs?status=accepted');
  assert(acceptedADRs.body.adrs.every((a: any) => a.status === 'accepted'), 
    'Should only return accepted ADRs');

  // Test search
  const searchADRs = await makeRequest('/api/adrs?search=versioning');
  assert(searchADRs.body.adrs.length >= 1, 'Should find ADRs by search term');

  // Test GET /api/adrs/:id
  const adrId = adrsResponse.body.adrs[0].id;
  const singleADR = await makeRequest(`/api/adrs/${adrId}`);
  assert(singleADR.status === 200, 'Should get ADR by ID');
  assert(singleADR.body.adr.id === adrId, 'Should return correct ADR');

  // Test POST /api/adrs
  const newADR = await makePostRequest('/api/adrs', {
    title: 'Test ADR',
    context: 'Testing context',
    decision: 'Test decision',
    consequences: 'Test consequences',
    created_by: 'architect'
  });
  assert(newADR.status === 201, 'Should create new ADR');
  assert(newADR.body.adr.title === 'Test ADR', 'Should return created ADR');

  // Test PUT /api/adrs/:id/status
  const updateStatus = await makePutRequest(`/api/adrs/${newADR.body.adr.id}/status`, {
    status: 'deprecated'
  });
  assert(updateStatus.status === 200, 'Should update ADR status');
  assert(updateStatus.body.adr.status === 'deprecated', 'Should have updated status');
}

async function testReviewEndpoints(storyId: string) {
  console.log('\n📍 Testing Review Endpoints...');

  // Test GET /api/reviews
  const reviewsResponse = await makeRequest(`/api/reviews?work_item=${storyId}`);
  assert(reviewsResponse.status === 200, 'Should return 200 for review search');
  assert(reviewsResponse.body.reviews.length >= 1, 'Should find reviews for work item');

  // Test filtering by type
  const codeReviews = await makeRequest(`/api/reviews?work_item=${storyId}&type=code`);
  assert(codeReviews.body.reviews.every((r: any) => r.review_type === 'code'), 
    'Should filter by review type');

  // Test review summary
  const summaryResponse = await makeRequest(`/api/reviews/work-item/${storyId}/summary`);
  assert(summaryResponse.status === 200, 'Should get review summary');
  assert(summaryResponse.body.summary.work_item_id === storyId, 'Should have correct work item');
  assert(summaryResponse.body.summary.total_reviews >= 1, 'Should have review count');
  assert(summaryResponse.body.summary.approved >= 1, 'Should have approval count');

  // Test POST /api/reviews
  const newReview = await makePostRequest('/api/reviews', {
    work_item_id: storyId,
    review_type: 'architecture',
    reviewer_role: 'architect',
    status: 'approved',
    feedback: 'Good architecture',
    quality_score: 0.85
  });
  assert(newReview.status === 201, 'Should create new review');
  assert(newReview.body.review.review_type === 'architecture', 'Should return created review');
}

async function testMessageEndpoints() {
  console.log('\n📍 Testing Message Endpoints...');

  // Test GET /api/messages
  const messagesResponse = await makeRequest('/api/messages?agent=developer');
  assert(messagesResponse.status === 200, 'Should return 200 for message search');
  assert(messagesResponse.body.messages.length >= 1, 'Should find messages for agent');

  // Test undelivered messages
  const undeliveredResponse = await makeRequest('/api/messages?agent=developer&undelivered_only=true');
  assert(undeliveredResponse.status === 200, 'Should get undelivered messages');

  // Test unread count
  const unreadResponse = await makeRequest('/api/messages/agent/developer/unread');
  assert(unreadResponse.status === 200, 'Should get unread count');
  assert(unreadResponse.body.total_unread >= 0, 'Should have unread count');

  // Test POST /api/messages
  const newMessage = await makePostRequest('/api/messages', {
    from_agent: 'manager',
    to_agent: 'developer',
    message_type: 'notification',
    priority: 'medium',
    subject: 'Test message',
    content: 'Test content'
  });
  assert(newMessage.status === 201, 'Should create new message');
  assert(newMessage.body.message_id !== undefined, 'Should return message ID');

  // Test broadcast
  const broadcastResponse = await makePostRequest('/api/messages/broadcast', {
    from_agent: 'manager',
    to_agents: ['developer', 'reviewer'],
    message_type: 'notification',
    priority: 'low',
    subject: 'Broadcast test',
    content: 'Test broadcast'
  });
  assert(broadcastResponse.status === 201, 'Should broadcast message');
  assert(broadcastResponse.body.messages_sent === 2, 'Should send to multiple agents');

  // Test mark as delivered
  const messageId = newMessage.body.message_id;
  const deliveredResponse = await makePutRequest(`/api/messages/${messageId}/delivered`, {});
  assert(deliveredResponse.status === 200, 'Should mark message as delivered');
}

async function runTests() {
  console.log('🧪 Starting API Endpoint Tests...\n');

  try {
    // Check if supertest is available
    try {
      await import('supertest');
    } catch {
      console.log('⚠️  Supertest not installed. Skipping API tests.');
      console.log('   Run: npm install --save-dev supertest @types/supertest');
      return;
    }

    // Setup
    cleanupTestDb();
    process.env.WADDLE_DB_PATH = TEST_DB_PATH;
    initializeDatabase();

    const { storyId } = await setupTestData();

    // Run tests
    await testPatternEndpoints();
    await testDecisionEndpoints(storyId);
    await testADREndpoints(storyId);
    await testReviewEndpoints(storyId);
    await testMessageEndpoints();

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