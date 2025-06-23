import { AgentRole } from '../types/index.js';
import { WorkItem } from '../types/index.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { getLogger } from '../utils/logger.js';
import { AgentMessaging, AgentMessageHandler } from '../services/agent-messaging.js';
import { AgentCommunication, MessageType } from '../types/knowledge.js';
import { claimWorkItem, releaseWorkItem, updateWorkItemStatus, addHistory } from '../database/utils.js';

const logger = getLogger();

export interface AgentConfig {
  role: AgentRole;
  config: OrchestratorConfig;
  messageHandlers?: Partial<Record<MessageType, AgentMessageHandler>>;
  checkMessagesInterval?: number;
}

export abstract class BaseAgent {
  protected role: AgentRole;
  protected config: OrchestratorConfig;
  protected messaging: AgentMessaging;
  protected currentWorkItem?: string;
  protected agentId: string;

  constructor({ role, config, messageHandlers, checkMessagesInterval }: AgentConfig) {
    this.role = role;
    this.config = config;
    this.agentId = `${role}-${Date.now()}`;
    
    // Set up messaging
    this.messaging = new AgentMessaging({
      agentRole: role,
      handlers: messageHandlers || this.getDefaultMessageHandlers(),
      defaultHandler: this.handleUnknownMessage.bind(this),
      checkIntervalMs: checkMessagesInterval || 30000 // Default 30 seconds
    });
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    logger.info('Starting agent', { role: this.role, agentId: this.agentId });
    this.messaging.start();
    await this.onStart();
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    logger.info('Stopping agent', { role: this.role, agentId: this.agentId });
    this.messaging.stop();
    
    // Release any claimed work item
    if (this.currentWorkItem) {
      releaseWorkItem(this.currentWorkItem, this.agentId);
      this.currentWorkItem = undefined;
    }
    
    await this.onStop();
  }

  /**
   * Process a work item with message checking
   */
  async processWorkItem(workItemId: string): Promise<boolean> {
    try {
      // Try to claim the work item
      if (!claimWorkItem(workItemId, this.agentId)) {
        logger.warn('Work item already claimed', { workItemId, agent: this.role });
        return false;
      }
      
      this.currentWorkItem = workItemId;
      
      // Update status
      updateWorkItemStatus(workItemId, 'in_progress', this.role);
      
      // Check for any high priority messages before starting
      await this.checkHighPriorityMessages();
      
      // Process the work item
      const result = await this.doProcessWorkItem(workItemId);
      
      // Check messages again after processing
      await this.messaging.checkMessages();
      
      return result;
    } catch (error) {
      logger.error('Error processing work item', {
        workItemId,
        agent: this.role,
        error: error as Error
      });
      
      // Record error in history
      addHistory(
        workItemId, 
        'error', 
        `Agent ${this.role} failed: ${(error as Error).message}`, 
        this.role
      );
      
      return false;
    } finally {
      // Always release the work item
      if (this.currentWorkItem === workItemId) {
        releaseWorkItem(workItemId, this.agentId);
        this.currentWorkItem = undefined;
      }
    }
  }

  /**
   * Check for high priority messages
   */
  protected async checkHighPriorityMessages(): Promise<void> {
    const stats = await this.messaging.getStats();
    if (stats.byPriority.urgent > 0 || stats.byPriority.high > 0) {
      logger.info('Processing high priority messages', {
        agent: this.role,
        urgent: stats.byPriority.urgent,
        high: stats.byPriority.high
      });
      await this.messaging.checkMessages();
    }
  }

  /**
   * Get default message handlers for this agent
   */
  protected getDefaultMessageHandlers(): Partial<Record<MessageType, AgentMessageHandler>> {
    return {
      question: this.handleQuestion.bind(this),
      insight: this.handleInsight.bind(this),
      warning: this.handleWarning.bind(this),
      handoff: this.handleHandoff.bind(this)
    };
  }

  /**
   * Handle a question from another agent
   */
  protected async handleQuestion(message: AgentCommunication): Promise<void> {
    logger.info('Received question', {
      agent: this.role,
      from: message.from_agent,
      subject: message.subject
    });
    
    // Default implementation - subclasses should override
    await this.messaging.shareInsight(
      message.from_agent as AgentRole,
      `Re: ${message.subject}`,
      `I received your question but don't have a specific answer at this time.`,
      message.work_item_id || undefined
    );
  }

  /**
   * Handle an insight from another agent
   */
  protected async handleInsight(message: AgentCommunication): Promise<void> {
    logger.info('Received insight', {
      agent: this.role,
      from: message.from_agent,
      subject: message.subject
    });
    
    // Store insight in work item history if applicable
    if (message.work_item_id) {
      addHistory(
        message.work_item_id,
        'agent_output',
        `Insight from ${message.from_agent}: ${message.content}`,
        this.role
      );
    }
  }

  /**
   * Handle a warning from another agent
   */
  protected async handleWarning(message: AgentCommunication): Promise<void> {
    logger.warn('Received warning', {
      agent: this.role,
      from: message.from_agent,
      subject: message.subject,
      content: message.content
    });
    
    // Warnings should be acted upon immediately
    if (message.work_item_id && message.work_item_id === this.currentWorkItem) {
      // If warning is about current work, consider pausing
      await this.onWarningReceived(message);
    }
  }

  /**
   * Handle a work handoff from another agent
   */
  protected async handleHandoff(message: AgentCommunication): Promise<void> {
    logger.info('Received work handoff', {
      agent: this.role,
      from: message.from_agent,
      workItem: message.work_item_id,
      subject: message.subject
    });
    
    if (message.work_item_id) {
      // Queue the work item for processing
      await this.onWorkHandoff(message);
    }
  }

  /**
   * Handle unknown message types
   */
  protected async handleUnknownMessage(message: AgentCommunication): Promise<void> {
    logger.warn('Received unknown message type', {
      agent: this.role,
      from: message.from_agent,
      type: message.message_type,
      subject: message.subject
    });
  }

  /**
   * Lifecycle hooks for subclasses
   */
  protected async onStart(): Promise<void> {}
  protected async onStop(): Promise<void> {}
  protected async onWarningReceived(message: AgentCommunication): Promise<void> {}
  protected async onWorkHandoff(message: AgentCommunication): Promise<void> {}

  /**
   * Abstract method that subclasses must implement
   */
  protected abstract doProcessWorkItem(workItemId: string): Promise<boolean>;
}