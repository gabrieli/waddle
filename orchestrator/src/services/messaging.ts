import { getDatabase } from '../database/connection.js';
import { executeQuery } from '../database/utils.js';
import { getLogger } from '../utils/logger.js';
import {
  sendMessage,
  getMessage,
  updateMessageStatus,
  getMessagesForAgent,
  getUndeliveredMessages
} from '../database/knowledge.js';
import {
  AgentCommunication,
  MessageCreateParams,
  MessageStatus,
  MessageType,
  Priority
} from '../types/knowledge.js';
import { AgentRole } from '../types/index.js';

const logger = getLogger();

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_BASE = 60000; // 1 minute base delay

export interface MessageServiceConfig {
  maxRetries?: number;
  retryDelayBase?: number;
  deadLetterAfterDays?: number;
}

export class MessageService {
  private config: Required<MessageServiceConfig>;

  constructor(config?: MessageServiceConfig) {
    this.config = {
      maxRetries: config?.maxRetries ?? MAX_RETRY_COUNT,
      retryDelayBase: config?.retryDelayBase ?? RETRY_DELAY_BASE,
      deadLetterAfterDays: config?.deadLetterAfterDays ?? 7
    };
  }

  /**
   * Send a message with automatic retry handling
   */
  async sendMessageWithRetry(params: MessageCreateParams): Promise<AgentCommunication> {
    const message = sendMessage(params);
    return message;
  }

  /**
   * Process a message and handle failures
   */
  async processMessage(
    messageId: string, 
    processor: (message: AgentCommunication) => Promise<void>
  ): Promise<boolean> {
    const message = getMessage(messageId);
    if (!message) {
      logger.warn('Message not found', { messageId });
      return false;
    }

    if (message.is_dead_letter) {
      logger.info('Skipping dead letter message', { messageId });
      return false;
    }

    try {
      // Mark as processing
      updateMessageStatus(messageId, 'read', 'read_at');
      
      // Process the message
      await processor(message);
      
      // Mark as processed
      updateMessageStatus(messageId, 'processed', 'processed_at');
      
      logger.info('Message processed successfully', {
        messageId,
        type: message.message_type,
        from: message.from_agent,
        to: message.to_agent
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to process message', {
        messageId,
        error: error as Error,
        retryCount: message.retry_count
      });
      
      // Handle retry logic
      await this.handleMessageFailure(messageId, error as Error);
      return false;
    }
  }

  /**
   * Handle message processing failure
   */
  private async handleMessageFailure(messageId: string, error: Error): Promise<void> {
    const db = getDatabase();
    const message = getMessage(messageId);
    
    if (!message) return;

    const newRetryCount = message.retry_count + 1;
    const shouldMoveToDeadLetter = newRetryCount >= this.config.maxRetries;

    if (shouldMoveToDeadLetter) {
      // Move to dead letter queue
      const query = `
        UPDATE agent_communications
        SET status = 'failed',
            is_dead_letter = 1,
            error_message = ?,
            retry_count = ?,
            last_retry_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      executeQuery(
        'moveToDeadLetter',
        query,
        [error.message || 'Unknown error', newRetryCount, messageId],
        () => db.prepare(query).run(error.message || 'Unknown error', newRetryCount, messageId),
        { messageId }
      );
      
      logger.warn('Message moved to dead letter queue', {
        messageId,
        retryCount: newRetryCount,
        error: error.message || 'Unknown error'
      });
    } else {
      // Update retry information
      const query = `
        UPDATE agent_communications
        SET status = 'pending',
            retry_count = ?,
            last_retry_at = CURRENT_TIMESTAMP,
            error_message = ?
        WHERE id = ?
      `;
      
      executeQuery(
        'updateRetryInfo',
        query,
        [newRetryCount, error.message || 'Unknown error', messageId],
        () => db.prepare(query).run(newRetryCount, error.message || 'Unknown error', messageId),
        { messageId, newRetryCount }
      );
      
      logger.info('Message marked for retry', {
        messageId,
        retryCount: newRetryCount,
        nextRetryDelay: this.calculateRetryDelay(newRetryCount)
      });
    }
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  private calculateRetryDelay(retryCount: number): number {
    return this.config.retryDelayBase * Math.pow(2, retryCount - 1);
  }

  /**
   * Get messages ready for retry
   */
  async getMessagesForRetry(agentId?: string): Promise<AgentCommunication[]> {
    const db = getDatabase();
    
    let query = `
      SELECT * FROM agent_communications
      WHERE status = 'pending'
        AND retry_count > 0
        AND retry_count < ?
        AND is_dead_letter = 0
        AND (
          last_retry_at IS NULL 
          OR datetime(last_retry_at, '+' || (? * (1 << (retry_count - 1))) || ' seconds') <= datetime('now')
        )
    `;
    
    const params: any[] = [this.config.maxRetries, this.config.retryDelayBase / 1000];
    
    if (agentId) {
      query += ` AND to_agent = ?`;
      params.push(agentId);
    }
    
    query += ` ORDER BY priority DESC, created_at ASC`;
    
    return executeQuery(
      'getMessagesForRetry',
      query,
      params,
      () => db.prepare(query).all(...params) as AgentCommunication[],
      { agentId }
    );
  }

  /**
   * Get dead letter messages
   */
  async getDeadLetterMessages(agentId?: string): Promise<AgentCommunication[]> {
    const db = getDatabase();
    
    let query = `
      SELECT * FROM agent_communications
      WHERE is_dead_letter = 1
    `;
    
    const params: any[] = [];
    
    if (agentId) {
      query += ` AND to_agent = ?`;
      params.push(agentId);
    }
    
    query += ` ORDER BY last_retry_at DESC`;
    
    return executeQuery(
      'getDeadLetterMessages',
      query,
      params,
      () => db.prepare(query).all(...params) as AgentCommunication[],
      { agentId }
    );
  }

  /**
   * Resurrect a message from dead letter queue
   */
  async resurrectMessage(messageId: string): Promise<boolean> {
    const db = getDatabase();
    
    const query = `
      UPDATE agent_communications
      SET is_dead_letter = 0,
          status = 'pending',
          retry_count = 0,
          error_message = NULL,
          last_retry_at = NULL
      WHERE id = ? AND is_dead_letter = 1
    `;
    
    const result = executeQuery(
      'resurrectMessage',
      query,
      [messageId],
      () => db.prepare(query).run(messageId),
      { messageId }
    );
    
    if (result.changes > 0) {
      logger.info('Message resurrected from dead letter queue', { messageId });
      return true;
    }
    
    return false;
  }

  /**
   * Get message statistics for an agent
   */
  async getMessageStats(agentId: string): Promise<{
    pending: number;
    delivered: number;
    processed: number;
    failed: number;
    deadLetter: number;
    byPriority: Record<Priority, number>;
    byType: Record<MessageType, number>;
  }> {
    const db = getDatabase();
    
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM agent_communications
      WHERE to_agent = ?
      GROUP BY status
    `;
    
    const statusResults = executeQuery(
      'getMessageStatusStats',
      statusQuery,
      [agentId],
      () => db.prepare(statusQuery).all(agentId) as Array<{status: MessageStatus, count: number}>,
      { agentId }
    );
    
    const deadLetterQuery = `
      SELECT COUNT(*) as count
      FROM agent_communications
      WHERE to_agent = ? AND is_dead_letter = 1
    `;
    
    const deadLetterResult = executeQuery(
      'getDeadLetterCount',
      deadLetterQuery,
      [agentId],
      () => db.prepare(deadLetterQuery).get(agentId) as {count: number},
      { agentId }
    );
    
    const priorityQuery = `
      SELECT 
        priority,
        COUNT(*) as count
      FROM agent_communications
      WHERE to_agent = ? AND status = 'pending' AND is_dead_letter = 0
      GROUP BY priority
    `;
    
    const priorityResults = executeQuery(
      'getMessagePriorityStats',
      priorityQuery,
      [agentId],
      () => db.prepare(priorityQuery).all(agentId) as Array<{priority: Priority, count: number}>,
      { agentId }
    );
    
    const typeQuery = `
      SELECT 
        message_type,
        COUNT(*) as count
      FROM agent_communications
      WHERE to_agent = ?
      GROUP BY message_type
    `;
    
    const typeResults = executeQuery(
      'getMessageTypeStats',
      typeQuery,
      [agentId],
      () => db.prepare(typeQuery).all(agentId) as Array<{message_type: MessageType, count: number}>,
      { agentId }
    );
    
    // Build stats object
    const stats = {
      pending: 0,
      delivered: 0,
      processed: 0,
      failed: 0,
      deadLetter: deadLetterResult.count,
      byPriority: {} as Record<Priority, number>,
      byType: {} as Record<MessageType, number>
    };
    
    // Populate status counts
    statusResults.forEach(row => {
      switch (row.status) {
        case 'pending':
          stats.pending = row.count;
          break;
        case 'delivered':
          stats.delivered = row.count;
          break;
        case 'processed':
          stats.processed = row.count;
          break;
        case 'failed':
          stats.failed = row.count;
          break;
      }
    });
    
    // Populate priority counts
    priorityResults.forEach(row => {
      stats.byPriority[row.priority] = row.count;
    });
    
    // Populate type counts
    typeResults.forEach(row => {
      stats.byType[row.message_type] = row.count;
    });
    
    return stats;
  }

  /**
   * Clean up old dead letter messages
   */
  async cleanupDeadLetterQueue(daysOld: number = 30): Promise<number> {
    const db = getDatabase();
    
    const query = `
      DELETE FROM agent_communications
      WHERE is_dead_letter = 1
        AND datetime(last_retry_at, '+' || ? || ' days') <= datetime('now')
    `;
    
    const result = executeQuery(
      'cleanupDeadLetterQueue',
      query,
      [daysOld],
      () => db.prepare(query).run(daysOld),
      { daysOld }
    );
    
    if (result.changes > 0) {
      logger.info('Cleaned up dead letter messages', {
        count: result.changes,
        daysOld
      });
    }
    
    return result.changes;
  }
}

// Export singleton instance
export const messageService = new MessageService();