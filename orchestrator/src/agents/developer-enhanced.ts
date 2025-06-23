import { BaseAgent } from './base-agent.js';
import { WorkItem } from '../types/index.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { getWorkItem, updateWorkItemStatus, addHistory, getWorkItemHistory, getBugMetadata } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildDeveloperPrompt } from './prompts.js';
import { parseAgentJsonResponse } from './json-parser.js';
import { AgentCommunication } from '../types/knowledge.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export interface DeveloperImplementationResult {
  status: 'completed' | 'blocked' | 'in_progress';
  implementationNotes: string;
  filesChanged: string[];
  testsAdded: boolean;
  temporaryArtifactsRemoved?: string[];
  blockers?: string[];
}

export class EnhancedDeveloperAgent extends BaseAgent {
  private pendingQuestions: Map<string, string> = new Map();

  constructor(config: OrchestratorConfig) {
    super({
      role: 'developer',
      config,
      checkMessagesInterval: 20000 // Check every 20 seconds
    });
  }

  /**
   * Handle questions from other agents
   */
  protected async handleQuestion(message: AgentCommunication): Promise<void> {
    logger.info('Developer received question', {
      from: message.from_agent,
      subject: message.subject,
      workItem: message.work_item_id
    });

    // If the question is about implementation details
    if (message.subject.includes('implementation') || message.subject.includes('technical')) {
      // Check if we have context about this work item
      if (message.work_item_id) {
        const history = getWorkItemHistory(message.work_item_id);
        const ourWork = history.find(h => 
          h.action === 'agent_output' && 
          h.created_by === 'developer'
        );

        if (ourWork) {
          await this.messaging.shareInsight(
            message.from_agent as any,
            `Re: ${message.subject}`,
            `Based on my implementation: ${ourWork.content}`,
            message.work_item_id
          );
          return;
        }
      }
    }

    // Default response
    await super.handleQuestion(message);
  }

  /**
   * Handle warnings - especially important for developers
   */
  protected async handleWarning(message: AgentCommunication): Promise<void> {
    await super.handleWarning(message);

    // If warning is about code quality or security
    if (message.subject.includes('security') || message.subject.includes('quality')) {
      logger.warn('Received code quality/security warning', {
        from: message.from_agent,
        content: message.content
      });

      // If we're currently working on this item, we should address it
      if (message.work_item_id === this.currentWorkItem) {
        // Store the warning to address in our implementation
        this.pendingQuestions.set('warning_' + message.id, message.content);
      }
    }
  }

  /**
   * Process work item with messaging integration
   */
  protected async doProcessWorkItem(workItemId: string): Promise<boolean> {
    logger.info('Developer processing work item', { workItemId });

    try {
      // Get the work item details
      const workItem = getWorkItem(workItemId);
      if (!workItem || (workItem.type !== 'story' && workItem.type !== 'bug')) {
        logger.error('Work item not found or not a story/bug', { workItemId });
        return false;
      }

      // Get technical context
      const technicalContext = await this.getTechnicalContext(workItem);

      // Check if architect has any insights for us
      const messages = await this.messaging.getStats();
      if (messages.byType.insight > 0) {
        await this.messaging.checkMessages();
      }

      // If we have blockers, ask for help
      if (technicalContext.includes('BLOCKED') || technicalContext.includes('MISSING')) {
        await this.askForHelp(workItem, technicalContext);
        return false;
      }

      // Build and execute prompt
      const prompt = await buildDeveloperPrompt(workItem, technicalContext);
      const result = await executeClaudeAgent('developer', prompt, this.config, this.config.maxBufferMB);

      if (!result.success) {
        const errorMessage = result.error || 'Unknown error';
        logger.error('Developer agent failed', { error: new Error(errorMessage) });
        
        // Notify manager about the failure
        await this.messaging.sendWarning(
          'manager',
          `Development failed for ${workItemId}`,
          `Failed to implement ${workItem.title}: ${errorMessage}`,
          workItemId
        );
        
        addHistory(workItemId, 'agent_output', `Development failed: ${errorMessage}`, 'developer');
        return false;
      }

      // Parse implementation result
      const parseResult = parseAgentJsonResponse<DeveloperImplementationResult>(result.output, 'developer');

      if (!parseResult.success) {
        const parseError = parseResult.error || 'Unknown parsing error';
        logger.error('Failed to parse developer implementation', { error: new Error(parseError) });
        return false;
      }

      const implementation = parseResult.data;
      if (!implementation) {
        logger.error('No implementation data received');
        return false;
      }

      // Handle different statuses
      switch (implementation.status) {
        case 'completed':
          // Share success with team
          await this.messaging.shareInsight(
            'manager',
            `Completed implementation of ${workItem.title}`,
            `Implementation notes: ${implementation.implementationNotes}\nFiles changed: ${implementation.filesChanged.join(', ')}\nTests added: ${implementation.testsAdded}`,
            workItemId,
            'high'
          );
          
          updateWorkItemStatus(workItemId, 'review', 'developer');
          addHistory(workItemId, 'agent_output', JSON.stringify(implementation), 'developer');
          
          // Handoff to reviewer
          await this.messaging.handoffWork(
            'reviewer',
            `Ready for review: ${workItem.title}`,
            `Please review the implementation. Files changed: ${implementation.filesChanged.join(', ')}`,
            workItemId
          );
          
          return true;

        case 'blocked':
          // Ask for help with blockers
          for (const blocker of implementation.blockers || []) {
            await this.messaging.askQuestion(
              'architect',
              `Blocked on ${workItem.title}`,
              `I'm blocked by: ${blocker}. Can you provide guidance?`,
              workItemId,
              'high'
            );
          }
          
          addHistory(workItemId, 'agent_output', `Blocked: ${implementation.blockers?.join(', ')}`, 'developer');
          return false;

        case 'in_progress':
          // Share progress update
          await this.messaging.shareInsight(
            'manager',
            `Progress update on ${workItem.title}`,
            implementation.implementationNotes,
            workItemId
          );
          
          addHistory(workItemId, 'agent_output', `In progress: ${implementation.implementationNotes}`, 'developer');
          return false;
      }
    } catch (error) {
      logger.error('Error in developer agent', { error: error as Error, workItemId });
      
      // Notify about the error
      await this.messaging.sendWarning(
        'manager',
        `Developer error on ${workItemId}`,
        `Unexpected error: ${(error as Error).message}`,
        workItemId,
        'urgent'
      );
      
      return false;
    }
  }

  /**
   * Get technical context for the work item
   */
  private async getTechnicalContext(workItem: WorkItem): Promise<string> {
    let technicalContext = 'No technical context available';

    if (workItem.type === 'bug') {
      const bugMetadata = getBugMetadata(workItem.id);
      if (bugMetadata) {
        const tempArtifacts = JSON.parse(bugMetadata.temporary_artifacts || '[]');
        technicalContext = `Bug Analysis:
Root Cause: ${bugMetadata.root_cause}
Suggested Fix: ${bugMetadata.suggested_fix || 'None provided'}
Reproduction Test:
${bugMetadata.reproduction_test}
Temporary Artifacts to Clean: ${tempArtifacts.join(', ')}`;
      }
    } else if (workItem.parent_id) {
      const epicHistory = getWorkItemHistory(workItem.parent_id);
      const architectOutput = epicHistory.find(h => 
        h.action === 'agent_output' && h.created_by === 'architect'
      );
      if (architectOutput && architectOutput.content) {
        try {
          const analysis = JSON.parse(architectOutput.content);
          technicalContext = `Technical Approach: ${analysis.technicalApproach}\nDependencies: ${analysis.dependencies?.join(', ') || 'None'}`;
        } catch (e) {
          technicalContext = architectOutput.content;
        }
      }
    }

    // Add any pending warnings to context
    if (this.pendingQuestions.size > 0) {
      const warnings = Array.from(this.pendingQuestions.values()).join('\n');
      technicalContext += `\n\nPending Warnings to Address:\n${warnings}`;
      this.pendingQuestions.clear();
    }

    return technicalContext;
  }

  /**
   * Ask for help when blocked
   */
  private async askForHelp(workItem: WorkItem, context: string): Promise<void> {
    await this.messaging.askQuestion(
      'architect',
      `Need help with ${workItem.title}`,
      `I need technical guidance. Current context: ${context}`,
      workItem.id,
      'high'
    );
  }
}

/**
 * Factory function to run the enhanced developer agent
 */
export async function runEnhancedDeveloperAgent(workItemId: string, config: OrchestratorConfig): Promise<void> {
  const agent = new EnhancedDeveloperAgent(config);
  
  try {
    await agent.start();
    await agent.processWorkItem(workItemId);
  } finally {
    await agent.stop();
  }
}