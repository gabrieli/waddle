import { AgentRole } from '../types/index.js';
import { 
  AgentCommunication, 
  MessageType, 
  Priority,
  MessageCreateParams 
} from '../types/knowledge.js';
import { getLogger } from '../utils/logger.js';
import { messageService } from './messaging.js';
import { getUndeliveredMessages } from '../database/knowledge.js';

const logger = getLogger();

export interface AgentMessageHandler {
  (message: AgentCommunication): Promise<void>;
}

export interface AgentMessagingConfig {
  agentRole: AgentRole;
  handlers: Partial<Record<MessageType, AgentMessageHandler>>;
  defaultHandler?: AgentMessageHandler;
  checkIntervalMs?: number;
  priorityThreshold?: Priority;
}

export class AgentMessaging {
  private config: AgentMessagingConfig;
  private isRunning: boolean = false;
  private checkInterval?: NodeJS.Timeout;

  constructor(config: AgentMessagingConfig) {
    this.config = {
      checkIntervalMs: 30000, // Default 30 seconds
      ...config
    };
  }

  /**
   * Start checking for messages periodically
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.checkMessages(); // Check immediately
    
    // Set up periodic checking
    this.checkInterval = setInterval(
      () => this.checkMessages(),
      this.config.checkIntervalMs!
    );
    
    logger.info('Agent messaging started', {
      agent: this.config.agentRole,
      checkInterval: this.config.checkIntervalMs
    });
  }

  /**
   * Stop checking for messages
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    
    logger.info('Agent messaging stopped', {
      agent: this.config.agentRole
    });
  }

  /**
   * Check and process messages for this agent
   */
  async checkMessages(): Promise<number> {
    if (!this.isRunning) return 0;
    
    try {
      // Get undelivered messages
      const messages = getUndeliveredMessages(this.config.agentRole);
      
      // Filter by priority if threshold is set
      const filteredMessages = this.filterByPriority(messages);
      
      if (filteredMessages.length > 0) {
        logger.info('Processing messages for agent', {
          agent: this.config.agentRole,
          messageCount: filteredMessages.length
        });
      }
      
      // Process messages
      let processedCount = 0;
      for (const message of filteredMessages) {
        const success = await this.processMessage(message);
        if (success) processedCount++;
      }
      
      // Also check for messages ready for retry
      const retryMessages = await messageService.getMessagesForRetry(this.config.agentRole);
      for (const message of retryMessages) {
        const success = await this.processMessage(message);
        if (success) processedCount++;
      }
      
      return processedCount;
    } catch (error) {
      logger.error('Error checking messages', {
        agent: this.config.agentRole,
        error: error as Error
      });
      return 0;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: AgentCommunication): Promise<boolean> {
    const handler = this.config.handlers[message.message_type] || this.config.defaultHandler;
    
    if (!handler) {
      logger.warn('No handler for message type', {
        agent: this.config.agentRole,
        messageType: message.message_type,
        messageId: message.id
      });
      return false;
    }
    
    return await messageService.processMessage(message.id, handler);
  }

  /**
   * Filter messages by priority threshold
   */
  private filterByPriority(messages: AgentCommunication[]): AgentCommunication[] {
    if (!this.config.priorityThreshold) return messages;
    
    const priorityOrder: Priority[] = ['urgent', 'high', 'medium', 'low'];
    const thresholdIndex = priorityOrder.indexOf(this.config.priorityThreshold);
    
    return messages.filter(msg => {
      const msgIndex = priorityOrder.indexOf(msg.priority);
      return msgIndex <= thresholdIndex;
    });
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(params: Omit<MessageCreateParams, 'from_agent'>): Promise<AgentCommunication> {
    return await messageService.sendMessageWithRetry({
      ...params,
      from_agent: this.config.agentRole
    });
  }

  /**
   * Send a question to another agent
   */
  async askQuestion(
    to: AgentRole,
    subject: string,
    question: string,
    workItemId?: string,
    priority: Priority = 'medium'
  ): Promise<AgentCommunication> {
    return await this.sendMessage({
      to_agent: to,
      message_type: 'question',
      subject,
      content: question,
      work_item_id: workItemId,
      priority
    });
  }

  /**
   * Share an insight with another agent
   */
  async shareInsight(
    to: AgentRole,
    subject: string,
    insight: string,
    workItemId?: string,
    priority: Priority = 'medium'
  ): Promise<AgentCommunication> {
    return await this.sendMessage({
      to_agent: to,
      message_type: 'insight',
      subject,
      content: insight,
      work_item_id: workItemId,
      priority
    });
  }

  /**
   * Send a warning to another agent
   */
  async sendWarning(
    to: AgentRole,
    subject: string,
    warning: string,
    workItemId?: string,
    priority: Priority = 'high'
  ): Promise<AgentCommunication> {
    return await this.sendMessage({
      to_agent: to,
      message_type: 'warning',
      subject,
      content: warning,
      work_item_id: workItemId,
      priority
    });
  }

  /**
   * Handoff work to another agent
   */
  async handoffWork(
    to: AgentRole,
    subject: string,
    handoffDetails: string,
    workItemId: string,
    priority: Priority = 'high'
  ): Promise<AgentCommunication> {
    return await this.sendMessage({
      to_agent: to,
      message_type: 'handoff',
      subject,
      content: handoffDetails,
      work_item_id: workItemId,
      priority
    });
  }

  /**
   * Get message statistics for this agent
   */
  async getStats() {
    return await messageService.getMessageStats(this.config.agentRole);
  }
}

/**
 * Create a message handler for logging
 */
export function createLoggingHandler(agentRole: AgentRole): AgentMessageHandler {
  return async (message: AgentCommunication) => {
    logger.info('Message received', {
      agent: agentRole,
      from: message.from_agent,
      type: message.message_type,
      subject: message.subject,
      priority: message.priority
    });
  };
}

/**
 * Create a composite handler that runs multiple handlers
 */
export function createCompositeHandler(...handlers: AgentMessageHandler[]): AgentMessageHandler {
  return async (message: AgentCommunication) => {
    for (const handler of handlers) {
      await handler(message);
    }
  };
}