import { WorkItem } from '../types/index.js';
import { ContextRetrievalService, RetrievalContext } from '../services/context-retrieval.js';
import { ContextManager } from './context-manager.js';
import { RelevanceScorer } from './relevance-scorer.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export interface EnhancedPromptConfig {
  enableHistoricalContext: boolean;
  enableKnowledgeBase: boolean;
  maxContextLength: number;
  contextManager?: ContextManager;
  contextRetrievalService?: ContextRetrievalService;
  relevanceScorer?: RelevanceScorer;
  minRelevanceScore?: number;
  maxKnowledgeItems?: number;
}

const DEFAULT_ENHANCED_CONFIG: EnhancedPromptConfig = {
  enableHistoricalContext: true,
  enableKnowledgeBase: true,
  maxContextLength: 3000,
  minRelevanceScore: 0.3,
  maxKnowledgeItems: 5
};

/**
 * Enhanced prompt builder that integrates knowledge base context
 */
export class EnhancedPromptBuilder {
  private config: EnhancedPromptConfig;
  private contextRetrievalService: ContextRetrievalService;

  constructor(config: Partial<EnhancedPromptConfig> = {}) {
    this.config = { ...DEFAULT_ENHANCED_CONFIG, ...config };
    this.contextRetrievalService = config.contextRetrievalService || new ContextRetrievalService();
  }

  async buildManagerPrompt(
    workItems: WorkItem[], 
    history: string, 
    recentErrors?: string
  ): Promise<string> {
    const { MANAGER_PROMPT } = await import('./prompts.js');
    
    const workItemsStr = workItems.map(item => 
      `- ${item.type.toUpperCase()} ${item.id}: "${item.title}" [${item.status}]${item.assigned_role ? ` (assigned: ${item.assigned_role})` : ''}`
    ).join('\n');
    
    let historicalContext = '';
    
    // Get traditional historical context
    if (this.config.enableHistoricalContext && this.config.contextManager) {
      try {
        const traditionalContext = await this.config.contextManager.getContextForAgent('manager');
        if (traditionalContext) {
          historicalContext += traditionalContext;
        }
      } catch (error) {
        logger.warn('Failed to get traditional context for manager:', error);
      }
    }
    
    // Get knowledge base context
    if (this.config.enableKnowledgeBase) {
      try {
        const knowledgeContext = await this.getKnowledgeContext('manager', workItems);
        if (knowledgeContext) {
          historicalContext += '\n\n' + knowledgeContext;
        }
      } catch (error) {
        logger.warn('Failed to get knowledge context for manager:', error);
      }
    }
    
    // Truncate if necessary
    if (historicalContext && historicalContext.length > this.config.maxContextLength) {
      historicalContext = historicalContext.substring(0, this.config.maxContextLength) + '\n[Context truncated]';
    }
    
    return MANAGER_PROMPT
      .replace('{workItems}', workItemsStr)
      .replace('{history}', history)
      .replace('{recentErrors}', recentErrors || 'No recent errors')
      .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
  }

  async buildArchitectPrompt(epic: WorkItem): Promise<string> {
    const { ARCHITECT_PROMPT } = await import('./prompts.js');
    
    const epicStr = `ID: ${epic.id}
Title: ${epic.title}
Description: ${epic.description || 'No description'}
Status: ${epic.status}`;
    
    let historicalContext = '';
    
    // Get traditional historical context
    if (this.config.enableHistoricalContext && this.config.contextManager) {
      try {
        const traditionalContext = await this.config.contextManager.getContextForAgent('architect', epic.id);
        if (traditionalContext) {
          historicalContext += traditionalContext;
        }
      } catch (error) {
        logger.warn('Failed to get traditional context for architect:', error);
      }
    }
    
    // Get knowledge base context
    if (this.config.enableKnowledgeBase) {
      try {
        const retrievalContext: RetrievalContext = {
          currentTask: `${epic.title}: ${epic.description || ''}`,
          agentRole: 'architect',
          workItemType: 'epic',
          workItemId: epic.id
        };
        
        const knowledge = this.contextRetrievalService.retrieveRelevantContext(retrievalContext, {
          maxResults: this.config.maxKnowledgeItems,
          minRelevanceScore: this.config.minRelevanceScore
        });
        
        const knowledgeStr = this.contextRetrievalService.formatContextForPrompt(knowledge);
        if (knowledgeStr) {
          historicalContext += '\n\n' + knowledgeStr;
        }
      } catch (error) {
        logger.warn('Failed to get knowledge context for architect:', error);
      }
    }
    
    // Truncate if necessary
    if (historicalContext && historicalContext.length > this.config.maxContextLength) {
      historicalContext = historicalContext.substring(0, this.config.maxContextLength) + '\n[Context truncated]';
    }
    
    return ARCHITECT_PROMPT
      .replace('{epic}', epicStr)
      .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
  }

  async buildDeveloperPrompt(
    workItem: WorkItem, 
    context: string
  ): Promise<string> {
    const { DEVELOPER_PROMPT } = await import('./prompts.js');
    
    const workItemStr = `ID: ${workItem.id}
Title: ${workItem.title}
Type: ${workItem.type}
Description: ${workItem.description || 'No description'}
Status: ${workItem.status}`;
    
    let historicalContext = '';
    
    // Get traditional historical context
    if (this.config.enableHistoricalContext && this.config.contextManager) {
      try {
        const traditionalContext = await this.config.contextManager.getContextForAgent('developer', workItem.id);
        if (traditionalContext) {
          historicalContext += traditionalContext;
        }
      } catch (error) {
        logger.warn('Failed to get traditional context for developer:', error);
      }
    }
    
    // Get knowledge base context
    if (this.config.enableKnowledgeBase) {
      try {
        const retrievalContext: RetrievalContext = {
          currentTask: `${workItem.title}: ${workItem.description || ''}`,
          agentRole: 'developer',
          workItemType: workItem.type,
          workItemId: workItem.id,
          parentContext: context
        };
        
        const knowledge = this.contextRetrievalService.retrieveRelevantContext(retrievalContext, {
          maxResults: this.config.maxKnowledgeItems,
          minRelevanceScore: this.config.minRelevanceScore
        });
        
        const knowledgeStr = this.contextRetrievalService.formatContextForPrompt(knowledge);
        if (knowledgeStr) {
          historicalContext += '\n\n' + knowledgeStr;
        }
      } catch (error) {
        logger.warn('Failed to get knowledge context for developer:', error);
      }
    }
    
    // Truncate if necessary
    if (historicalContext && historicalContext.length > this.config.maxContextLength) {
      historicalContext = historicalContext.substring(0, this.config.maxContextLength) + '\n[Context truncated]';
    }
    
    return DEVELOPER_PROMPT
      .replace('{workItem}', workItemStr)
      .replace('{technicalContext}', context)
      .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
  }

  async buildCodeQualityReviewerPrompt(
    workItem: WorkItem, 
    implementation: string
  ): Promise<string> {
    const { CODE_QUALITY_REVIEWER_PROMPT } = await import('./prompts.js');
    
    const itemStr = `ID: ${workItem.id}
Title: ${workItem.title}
Description: ${workItem.description || 'No description'}
Type: ${workItem.type}`;
    
    let historicalContext = '';
    
    // Get traditional historical context
    if (this.config.enableHistoricalContext && this.config.contextManager) {
      try {
        const traditionalContext = await this.config.contextManager.getContextForAgent('reviewer', workItem.id);
        if (traditionalContext) {
          historicalContext += traditionalContext;
        }
      } catch (error) {
        logger.warn('Failed to get traditional context for reviewer:', error);
      }
    }
    
    // Get knowledge base context
    if (this.config.enableKnowledgeBase) {
      try {
        const retrievalContext: RetrievalContext = {
          currentTask: `Review ${workItem.type}: ${workItem.title}`,
          agentRole: 'reviewer',
          workItemType: workItem.type,
          workItemId: workItem.id,
          parentContext: implementation
        };
        
        const knowledge = this.contextRetrievalService.retrieveRelevantContext(retrievalContext, {
          maxResults: this.config.maxKnowledgeItems,
          minRelevanceScore: this.config.minRelevanceScore
        });
        
        const knowledgeStr = this.contextRetrievalService.formatContextForPrompt(knowledge);
        if (knowledgeStr) {
          historicalContext += '\n\n' + knowledgeStr;
        }
      } catch (error) {
        logger.warn('Failed to get knowledge context for reviewer:', error);
      }
    }
    
    // Truncate if necessary
    if (historicalContext && historicalContext.length > this.config.maxContextLength) {
      historicalContext = historicalContext.substring(0, this.config.maxContextLength) + '\n[Context truncated]';
    }
    
    return CODE_QUALITY_REVIEWER_PROMPT
      .replace('{workItem}', itemStr)
      .replace('{implementation}', implementation)
      .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
  }

  async buildBugBusterPrompt(
    bug: WorkItem, 
    errorContext: string
  ): Promise<string> {
    const { BUG_BUSTER_PROMPT } = await import('./prompts.js');
    
    const bugStr = `ID: ${bug.id}
Title: ${bug.title}
Description: ${bug.description || 'No description'}
Status: ${bug.status}`;
    
    let historicalContext = '';
    
    // Get traditional historical context
    if (this.config.enableHistoricalContext && this.config.contextManager) {
      try {
        const traditionalContext = await this.config.contextManager.getContextForAgent('bug-buster', bug.id);
        if (traditionalContext) {
          historicalContext += traditionalContext;
        }
      } catch (error) {
        logger.warn('Failed to get traditional context for bug-buster:', error);
      }
    }
    
    // Get knowledge base context focusing on error patterns
    if (this.config.enableKnowledgeBase) {
      try {
        const retrievalContext: RetrievalContext = {
          currentTask: `Debug: ${bug.title}`,
          agentRole: 'bug-buster',
          workItemType: 'bug',
          workItemId: bug.id,
          parentContext: errorContext
        };
        
        const knowledge = this.contextRetrievalService.retrieveRelevantContext(retrievalContext, {
          maxResults: this.config.maxKnowledgeItems,
          minRelevanceScore: this.config.minRelevanceScore,
          patternTypes: ['error_handling', 'solution'] // Focus on error patterns
        });
        
        const knowledgeStr = this.contextRetrievalService.formatContextForPrompt(knowledge);
        if (knowledgeStr) {
          historicalContext += '\n\n' + knowledgeStr;
        }
      } catch (error) {
        logger.warn('Failed to get knowledge context for bug-buster:', error);
      }
    }
    
    // Truncate if necessary
    if (historicalContext && historicalContext.length > this.config.maxContextLength) {
      historicalContext = historicalContext.substring(0, this.config.maxContextLength) + '\n[Context truncated]';
    }
    
    return BUG_BUSTER_PROMPT
      .replace('{bug}', bugStr)
      .replace('{errorContext}', errorContext)
      .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
  }

  private async getKnowledgeContext(role: string, workItems: WorkItem[]): Promise<string> {
    // For manager, aggregate context from multiple work items
    if (workItems.length === 0) return '';
    
    // Sample a few work items to get relevant context
    const sampleItems = workItems.slice(0, 3);
    const allKnowledge = {
      patterns: [] as any[],
      adrs: [] as any[],
      reviews: [] as any[]
    };
    
    for (const item of sampleItems) {
      const retrievalContext: RetrievalContext = {
        currentTask: `${item.type}: ${item.title}`,
        agentRole: 'manager',
        workItemType: item.type,
        workItemId: item.id
      };
      
      const knowledge = this.contextRetrievalService.retrieveRelevantContext(retrievalContext, {
        maxResults: 2, // Fewer per item since we're aggregating
        minRelevanceScore: this.config.minRelevanceScore
      });
      
      allKnowledge.patterns.push(...knowledge.patterns);
      allKnowledge.adrs.push(...knowledge.adrs);
      allKnowledge.reviews.push(...knowledge.reviews);
    }
    
    // Deduplicate and limit
    allKnowledge.patterns = this.deduplicateByField(allKnowledge.patterns, 'id')
      .slice(0, this.config.maxKnowledgeItems);
    allKnowledge.adrs = this.deduplicateByField(allKnowledge.adrs, 'id')
      .slice(0, this.config.maxKnowledgeItems);
    allKnowledge.reviews = this.deduplicateByField(allKnowledge.reviews, 'id')
      .slice(0, this.config.maxKnowledgeItems);
    
    return this.contextRetrievalService.formatContextForPrompt(allKnowledge);
  }

  private deduplicateByField<T>(items: T[], field: keyof T): T[] {
    const seen = new Set();
    return items.filter(item => {
      const value = item[field];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
}