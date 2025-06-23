import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageService } from '../src/services/messaging.js';
import { AgentMessaging } from '../src/services/agent-messaging.js';
import { getDatabase } from '../src/database/connection.js';
import { runMigrations } from '../src/database/migrations.js';
import { 
  MessageCreateParams, 
  AgentCommunication,
  MessageType,
  Priority
} from '../src/types/knowledge.js';

// Mock the logger
vi.mock('../src/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

describe('Messaging System', () => {
  let messageService: MessageService;
  let db: any;

  beforeEach(() => {
    // Set environment to test mode
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = ':memory:';
    
    // Clear any existing database module cache
    vi.resetModules();
    
    // Import fresh database connection
    const { getDatabase } = require('../src/database/connection.js');
    db = getDatabase();
    
    // Create schema directly for tests
    const { SCHEMA } = require('../src/database/schema.js');
    
    // Create tables
    Object.entries(SCHEMA).forEach(([name, sql]) => {
      if (name !== 'indices' && typeof sql === 'string') {
        db.prepare(sql).run();
      }
    });
    
    // Create indexes
    if (SCHEMA.indices && Array.isArray(SCHEMA.indices)) {
      SCHEMA.indices.forEach((sql: string) => {
        db.prepare(sql).run();
      });
    }
    
    // Create service instance
    messageService = new MessageService({
      maxRetries: 3,
      retryDelayBase: 100, // Short delay for tests
      deadLetterAfterDays: 7
    });
  });

  afterEach(() => {
    // Close database if it exists
    if (db && db.open) {
      db.close();
    }
  });

  describe('MessageService', () => {
    it('should send a message successfully', async () => {
      const params: MessageCreateParams = {
        from_agent: 'manager',
        to_agent: 'developer',
        message_type: 'question',
        subject: 'Test Question',
        content: 'Can you help with this?',
        priority: 'medium'
      };

      const message = await messageService.sendMessageWithRetry(params);

      expect(message).toBeDefined();
      expect(message.id).toMatch(/^MSG-/);
      expect(message.from_agent).toBe('manager');
      expect(message.to_agent).toBe('developer');
      expect(message.message_type).toBe('question');
      expect(message.status).toBe('pending');
      expect(message.retry_count).toBe(0);
      expect(message.is_dead_letter).toBe(0);
    });

    it('should process a message successfully', async () => {
      // Send a message first
      const message = await messageService.sendMessageWithRetry({
        from_agent: 'architect',
        to_agent: 'developer',
        message_type: 'insight',
        subject: 'Architecture Decision',
        content: 'Use microservices pattern',
        priority: 'high'
      });

      let processedMessage: AgentCommunication | null = null;
      const processor = vi.fn(async (msg: AgentCommunication) => {
        processedMessage = msg;
      });

      const result = await messageService.processMessage(message.id, processor);

      expect(result).toBe(true);
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processedMessage).toBeDefined();
      expect(processedMessage!.id).toBe(message.id);

      // Check message status was updated
      const updatedMessage = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(message.id);
      expect(updatedMessage.status).toBe('processed');
      expect(updatedMessage.read_at).not.toBeNull();
      expect(updatedMessage.processed_at).not.toBeNull();
    });

    it('should handle message processing failure with retry', async () => {
      const message = await messageService.sendMessageWithRetry({
        from_agent: 'developer',
        to_agent: 'reviewer',
        message_type: 'handoff',
        subject: 'Code Review Request',
        content: 'Please review PR #123',
        priority: 'urgent'
      });

      const processor = vi.fn(async () => {
        throw new Error('Processing failed');
      });

      const result = await messageService.processMessage(message.id, processor);

      expect(result).toBe(false);
      expect(processor).toHaveBeenCalledTimes(1);

      // Check message was marked for retry
      const updatedMessage = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(message.id);
      expect(updatedMessage.status).toBe('pending');
      expect(updatedMessage.retry_count).toBe(1);
      expect(updatedMessage.error_message).toContain('Processing failed');
      expect(updatedMessage.last_retry_at).not.toBeNull();
    });

    it('should move message to dead letter queue after max retries', async () => {
      const message = await messageService.sendMessageWithRetry({
        from_agent: 'manager',
        to_agent: 'architect',
        message_type: 'warning',
        subject: 'Performance Issue',
        content: 'System is slow',
        priority: 'high'
      });

      const processor = vi.fn(async () => {
        throw new Error('Always fails');
      });

      // Fail 3 times to reach max retries
      for (let i = 0; i < 3; i++) {
        // Update retry count manually to simulate retries
        db.prepare('UPDATE agent_communications SET retry_count = ? WHERE id = ?')
          .run(i, message.id);
        
        await messageService.processMessage(message.id, processor);
      }

      // Check message was moved to dead letter
      const deadLetterMessage = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(message.id);
      expect(deadLetterMessage.status).toBe('failed');
      expect(deadLetterMessage.is_dead_letter).toBe(1);
      expect(deadLetterMessage.retry_count).toBe(3);
      expect(deadLetterMessage.error_message).toContain('Always fails');
    });

    it('should get messages for retry with exponential backoff', async () => {
      // Create messages with different retry counts
      const messages = [];
      for (let i = 0; i < 3; i++) {
        const msg = await messageService.sendMessageWithRetry({
          from_agent: 'developer',
          to_agent: 'manager',
          message_type: 'question',
          subject: `Question ${i}`,
          content: `Content ${i}`,
          priority: 'medium'
        });
        
        // Simulate failed attempts
        db.prepare(`
          UPDATE agent_communications 
          SET retry_count = ?, 
              last_retry_at = datetime('now', '-' || ? || ' seconds'),
              status = 'pending'
          WHERE id = ?
        `).run(i + 1, (i + 1) * 60, msg.id);
        
        messages.push(msg);
      }

      const retryMessages = await messageService.getMessagesForRetry('manager');
      
      // Should get messages that are ready for retry based on exponential backoff
      expect(retryMessages.length).toBeGreaterThan(0);
      expect(retryMessages.every(m => m.retry_count > 0)).toBe(true);
      expect(retryMessages.every(m => m.retry_count < 3)).toBe(true);
    });

    it('should resurrect message from dead letter queue', async () => {
      // Create a dead letter message
      const message = await messageService.sendMessageWithRetry({
        from_agent: 'architect',
        to_agent: 'developer',
        message_type: 'insight',
        subject: 'Important Insight',
        content: 'This failed before',
        priority: 'high'
      });

      // Mark as dead letter
      db.prepare(`
        UPDATE agent_communications 
        SET is_dead_letter = 1, 
            status = 'failed',
            retry_count = 3,
            error_message = 'Previous error'
        WHERE id = ?
      `).run(message.id);

      const result = await messageService.resurrectMessage(message.id);
      expect(result).toBe(true);

      // Check message was resurrected
      const resurrectedMessage = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(message.id);
      expect(resurrectedMessage.is_dead_letter).toBe(0);
      expect(resurrectedMessage.status).toBe('pending');
      expect(resurrectedMessage.retry_count).toBe(0);
      expect(resurrectedMessage.error_message).toBeNull();
    });

    it('should get message statistics', async () => {
      // Create various messages
      const messageTypes: MessageType[] = ['question', 'insight', 'warning', 'handoff'];
      const priorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
      
      for (let i = 0; i < 10; i++) {
        await messageService.sendMessageWithRetry({
          from_agent: 'manager',
          to_agent: 'developer',
          message_type: messageTypes[i % 4],
          subject: `Test ${i}`,
          content: `Content ${i}`,
          priority: priorities[i % 4]
        });
      }

      // Update some message statuses
      db.prepare("UPDATE agent_communications SET status = 'delivered' WHERE id LIKE 'MSG-%' LIMIT 3").run();
      db.prepare("UPDATE agent_communications SET status = 'processed' WHERE id LIKE 'MSG-%' LIMIT 2").run();
      db.prepare("UPDATE agent_communications SET status = 'failed', is_dead_letter = 1 WHERE id LIKE 'MSG-%' LIMIT 1").run();

      const stats = await messageService.getMessageStats('developer');

      expect(stats).toBeDefined();
      expect(stats.pending).toBeGreaterThan(0);
      expect(stats.delivered).toBe(3);
      expect(stats.processed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.deadLetter).toBe(1);
      expect(Object.keys(stats.byPriority).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
    });
  });

  describe('AgentMessaging', () => {
    let agentMessaging: AgentMessaging;
    let messageHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      messageHandler = vi.fn(async (message: AgentCommunication) => {
        // Simulate successful processing
      });

      agentMessaging = new AgentMessaging({
        agentRole: 'developer',
        handlers: {
          question: messageHandler,
          insight: messageHandler
        },
        checkIntervalMs: 100 // Short interval for tests
      });
    });

    afterEach(() => {
      if (agentMessaging) {
        agentMessaging.stop();
      }
    });

    it('should send messages with convenience methods', async () => {
      const question = await agentMessaging.askQuestion(
        'architect',
        'Technical Question',
        'How should I implement this feature?',
        'STORY-123',
        'high'
      );

      expect(question.message_type).toBe('question');
      expect(question.from_agent).toBe('developer');
      expect(question.to_agent).toBe('architect');
      expect(question.priority).toBe('high');

      const insight = await agentMessaging.shareInsight(
        'manager',
        'Progress Update',
        'Feature is 50% complete',
        'STORY-123'
      );

      expect(insight.message_type).toBe('insight');

      const warning = await agentMessaging.sendWarning(
        'reviewer',
        'Security Concern',
        'Found SQL injection vulnerability'
      );

      expect(warning.message_type).toBe('warning');
      expect(warning.priority).toBe('high');

      const handoff = await agentMessaging.handoffWork(
        'reviewer',
        'Ready for Review',
        'All tests passing, please review',
        'STORY-123'
      );

      expect(handoff.message_type).toBe('handoff');
    });

    it('should process messages when checking', async () => {
      // Send messages to our agent
      await messageService.sendMessageWithRetry({
        from_agent: 'architect',
        to_agent: 'developer',
        message_type: 'question',
        subject: 'Design Question',
        content: 'Should we use pattern X?',
        priority: 'high'
      });

      await messageService.sendMessageWithRetry({
        from_agent: 'manager',
        to_agent: 'developer',
        message_type: 'insight',
        subject: 'Priority Change',
        content: 'This is now urgent',
        priority: 'urgent'
      });

      // Check messages
      const processedCount = await agentMessaging.checkMessages();

      expect(processedCount).toBe(2);
      expect(messageHandler).toHaveBeenCalledTimes(2);

      // Verify messages were processed
      const messages = db.prepare(
        "SELECT * FROM agent_communications WHERE to_agent = 'developer' AND status = 'processed'"
      ).all();
      expect(messages.length).toBe(2);
    });

    it('should filter messages by priority threshold', async () => {
      // Create agent with priority threshold
      const filteredAgent = new AgentMessaging({
        agentRole: 'manager',
        handlers: {
          warning: messageHandler
        },
        priorityThreshold: 'high' // Only process high and urgent
      });

      // Send messages with different priorities
      await messageService.sendMessageWithRetry({
        from_agent: 'developer',
        to_agent: 'manager',
        message_type: 'warning',
        subject: 'Low Priority Warning',
        content: 'Minor issue',
        priority: 'low'
      });

      await messageService.sendMessageWithRetry({
        from_agent: 'developer',
        to_agent: 'manager',
        message_type: 'warning',
        subject: 'High Priority Warning',
        content: 'Major issue',
        priority: 'high'
      });

      const processedCount = await filteredAgent.checkMessages();

      expect(processedCount).toBe(1); // Only high priority processed
      expect(messageHandler).toHaveBeenCalledTimes(1);

      filteredAgent.stop();
    });
  });

  describe('Dead Letter Queue Cleanup', () => {
    it('should clean up old dead letter messages', async () => {
      // Create old dead letter messages
      for (let i = 0; i < 5; i++) {
        const message = await messageService.sendMessageWithRetry({
          from_agent: 'manager',
          to_agent: 'developer',
          message_type: 'question',
          subject: `Old Question ${i}`,
          content: 'Old content',
          priority: 'low'
        });

        // Mark as dead letter with old date
        db.prepare(`
          UPDATE agent_communications 
          SET is_dead_letter = 1,
              status = 'failed',
              last_retry_at = datetime('now', '-35 days')
          WHERE id = ?
        `).run(message.id);
      }

      // Create recent dead letter message
      const recentMessage = await messageService.sendMessageWithRetry({
        from_agent: 'architect',
        to_agent: 'reviewer',
        message_type: 'handoff',
        subject: 'Recent Handoff',
        content: 'Recent content',
        priority: 'medium'
      });

      db.prepare(`
        UPDATE agent_communications 
        SET is_dead_letter = 1,
            status = 'failed',
            last_retry_at = datetime('now', '-5 days')
        WHERE id = ?
      `).run(recentMessage.id);

      // Clean up messages older than 30 days
      const deletedCount = await messageService.cleanupDeadLetterQueue(30);

      expect(deletedCount).toBe(5);

      // Verify old messages were deleted
      const remainingDeadLetters = db.prepare(
        'SELECT COUNT(*) as count FROM agent_communications WHERE is_dead_letter = 1'
      ).get();
      expect(remainingDeadLetters.count).toBe(1);
    });
  });
});