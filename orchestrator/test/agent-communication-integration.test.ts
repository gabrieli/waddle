import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getDatabase } from '../src/database/connection.js';
import { runMigrations } from '../src/database/migrations.js';
import { createWorkItem, updateWorkItemStatus } from '../src/database/utils.js';
import { MessageService } from '../src/services/messaging.js';
import { AgentMessaging } from '../src/services/agent-messaging.js';
import { AgentCommunication } from '../src/types/knowledge.js';

describe('Agent Communication Integration', () => {
  let db: any;
  let messageService: MessageService;

  beforeEach(() => {
    // Initialize in-memory database
    process.env.DATABASE_URL = ':memory:';
    db = getDatabase();
    
    // Run migrations
    runMigrations(db);
    
    // Create service instance
    messageService = new MessageService();
  });

  afterEach(() => {
    // Close database
    db.close();
  });

  it('should demonstrate complete agent communication workflow', async () => {
    // Create a story work item
    const story = createWorkItem({
      type: 'story',
      title: 'Implement user authentication',
      description: 'Add JWT-based authentication to the API',
      parent_id: null
    });

    // Simulate Manager starting the workflow
    const managerMessaging = new AgentMessaging({
      agentRole: 'manager',
      handlers: {
        insight: async (msg) => {
          console.log(`Manager received insight: ${msg.subject}`);
        }
      }
    });

    // Manager assigns to architect
    await managerMessaging.handoffWork(
      'architect',
      'New story for technical analysis',
      `Please analyze the technical approach for: ${story.title}`,
      story.id,
      'high'
    );

    // Simulate Architect analyzing and asking questions
    const architectMessaging = new AgentMessaging({
      agentRole: 'architect',
      handlers: {
        handoff: async (msg) => {
          console.log(`Architect received handoff: ${msg.subject}`);
          
          // Architect asks manager for clarification
          await architectMessaging.askQuestion(
            'manager',
            'Clarification needed on authentication',
            'Should we support OAuth2 providers or just JWT?',
            msg.work_item_id,
            'high'
          );
        },
        question: async (msg) => {
          // Manager's response
          if (msg.content.includes('OAuth2')) {
            await architectMessaging.shareInsight(
              'developer',
              'Authentication approach decided',
              'Use JWT for API authentication, OAuth2 support can be added later',
              msg.work_item_id
            );
          }
        }
      }
    });

    // Simulate Developer implementation
    const developerMessaging = new AgentMessaging({
      agentRole: 'developer',
      handlers: {
        insight: async (msg) => {
          console.log(`Developer received insight: ${msg.subject}`);
          
          // Developer encounters an issue
          await developerMessaging.sendWarning(
            'architect',
            'Security concern with JWT implementation',
            'Current JWT library has known vulnerabilities, should we use alternative?',
            msg.work_item_id,
            'urgent'
          );
        },
        warning: async (msg) => {
          if (msg.from_agent === 'reviewer') {
            // Handle reviewer warning
            await developerMessaging.shareInsight(
              'reviewer',
              'Security issue addressed',
              'Updated to use secure JWT library as recommended',
              msg.work_item_id
            );
          }
        }
      }
    });

    // Simulate Reviewer
    const reviewerMessaging = new AgentMessaging({
      agentRole: 'reviewer',
      handlers: {
        handoff: async (msg) => {
          console.log(`Reviewer received handoff: ${msg.subject}`);
          
          // Reviewer finds issue
          await reviewerMessaging.sendWarning(
            'developer',
            'Security vulnerability in JWT implementation',
            'JWT secret is hardcoded, must use environment variable',
            msg.work_item_id,
            'urgent'
          );
        },
        insight: async (msg) => {
          if (msg.content.includes('secure JWT library')) {
            // Approve the fix
            await reviewerMessaging.shareInsight(
              'manager',
              'Code review completed',
              'Authentication implementation approved after security fixes',
              msg.work_item_id,
              'high'
            );
          }
        }
      }
    });

    // Process the workflow
    managerMessaging.start();
    architectMessaging.start();
    developerMessaging.start();
    reviewerMessaging.start();

    // Check initial handoff
    let messages = await architectMessaging.checkMessages();
    expect(messages).toBe(1);

    // Architect processes and asks question
    messages = await managerMessaging.checkMessages();
    expect(messages).toBe(1);

    // Manager responds (simulated by triggering architect's question handler)
    const managerResponse = db.prepare(
      "SELECT * FROM agent_communications WHERE to_agent = 'architect' AND message_type = 'question'"
    ).get();
    await architectMessaging.handlers.question!(managerResponse);

    // Developer receives insight
    messages = await developerMessaging.checkMessages();
    expect(messages).toBe(1);

    // Check warning was sent
    const warnings = db.prepare(
      "SELECT * FROM agent_communications WHERE message_type = 'warning'"
    ).all();
    expect(warnings.length).toBeGreaterThan(0);

    // Verify complete communication chain
    const allMessages = db.prepare(
      "SELECT * FROM agent_communications ORDER BY created_at"
    ).all();

    // Should have messages for complete workflow
    expect(allMessages.length).toBeGreaterThan(4);
    
    // Check message types used
    const messageTypes = new Set(allMessages.map((m: any) => m.message_type));
    expect(messageTypes.has('handoff')).toBe(true);
    expect(messageTypes.has('question')).toBe(true);
    expect(messageTypes.has('insight')).toBe(true);
    expect(messageTypes.has('warning')).toBe(true);

    // Stop all agents
    managerMessaging.stop();
    architectMessaging.stop();
    developerMessaging.stop();
    reviewerMessaging.stop();
  });

  it('should handle message retry and dead letter queue', async () => {
    let processAttempts = 0;
    
    // Create an agent that fails processing initially
    const unreliableAgent = new AgentMessaging({
      agentRole: 'developer',
      handlers: {
        question: async (msg) => {
          processAttempts++;
          if (processAttempts < 3) {
            throw new Error(`Processing attempt ${processAttempts} failed`);
          }
          // Success on third attempt
          console.log('Finally processed the message!');
        }
      }
    });

    // Send a message
    await messageService.sendMessageWithRetry({
      from_agent: 'architect',
      to_agent: 'developer',
      message_type: 'question',
      subject: 'Technical question',
      content: 'How should we handle retries?',
      priority: 'medium'
    });

    // First attempt - will fail
    await unreliableAgent.checkMessages();
    expect(processAttempts).toBe(1);

    // Check message is marked for retry
    let message = db.prepare(
      "SELECT * FROM agent_communications WHERE to_agent = 'developer'"
    ).get();
    expect(message.retry_count).toBe(1);
    expect(message.status).toBe('pending');

    // Wait and try again (simulating retry delay)
    await new Promise(resolve => setTimeout(resolve, 150));

    // Get messages ready for retry
    const retryMessages = await messageService.getMessagesForRetry('developer');
    expect(retryMessages.length).toBe(1);

    // Process retry - will fail again
    await unreliableAgent.checkMessages();
    expect(processAttempts).toBe(2);

    // Update message manually to simulate it being ready for final retry
    db.prepare(
      "UPDATE agent_communications SET last_retry_at = datetime('now', '-1 minute') WHERE to_agent = 'developer'"
    ).run();

    // Final attempt - should succeed
    await unreliableAgent.checkMessages();
    expect(processAttempts).toBe(3);

    // Check message is now processed
    message = db.prepare(
      "SELECT * FROM agent_communications WHERE to_agent = 'developer'"
    ).get();
    expect(message.status).toBe('processed');
    expect(message.retry_count).toBe(2); // Retry count from before success

    unreliableAgent.stop();
  });

  it('should handle communication metrics correctly', async () => {
    // Create various types of communications
    const agents = ['manager', 'architect', 'developer', 'reviewer'];
    const messageTypes = ['question', 'insight', 'warning', 'handoff'] as const;
    
    // Generate communication patterns
    for (let i = 0; i < 20; i++) {
      const fromAgent = agents[i % agents.length];
      const toAgent = agents[(i + 1) % agents.length];
      const messageType = messageTypes[i % messageTypes.length];
      
      await messageService.sendMessageWithRetry({
        from_agent: fromAgent,
        to_agent: toAgent,
        message_type: messageType,
        subject: `Test ${messageType} ${i}`,
        content: `Content for ${messageType}`,
        priority: i % 2 === 0 ? 'high' : 'medium'
      });
    }

    // Process some messages
    const devMessaging = new AgentMessaging({
      agentRole: 'developer',
      handlers: {
        question: async () => {},
        insight: async () => {},
        warning: async () => {},
        handoff: async () => {}
      }
    });

    await devMessaging.checkMessages();

    // Get statistics
    const stats = await messageService.getMessageStats('developer');
    
    expect(stats.pending).toBeGreaterThan(0);
    expect(stats.processed).toBeGreaterThan(0);
    expect(Object.keys(stats.byType).length).toBe(4);
    expect(Object.keys(stats.byPriority).length).toBeGreaterThan(0);

    // Check communication patterns
    const patterns = db.prepare(`
      SELECT 
        from_agent,
        to_agent,
        message_type,
        COUNT(*) as count
      FROM agent_communications
      GROUP BY from_agent, to_agent, message_type
      ORDER BY count DESC
    `).all();

    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].count).toBeGreaterThan(0);

    devMessaging.stop();
  });
});