import { WorkItem, WorkHistory } from '../types/index.js';
import { getWorkItemHistory, getWorkItem, getChildWorkItems, getDatabase } from '../database/utils.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export interface HistoricalContext {
  workItemId: string;
  relevantHistory: WorkHistory[];
  relatedItems: WorkItem[];
  successPatterns: string[];
  errorPatterns: string[];
  agentPerformance: Map<string, AgentPerformanceMetrics>;
}

export interface AgentPerformanceMetrics {
  successRate: number;
  averageExecutionTime: number;
  commonErrors: string[];
  lastSuccess?: Date;
  lastFailure?: Date;
}

export interface ContextConfig {
  maxHistoryItems: number;
  maxRelatedItems: number;
  lookbackHours: number;
  enableCaching: boolean;
  cacheTTLMinutes: number;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxHistoryItems: 10,
  maxRelatedItems: 5,
  lookbackHours: 168, // 1 week
  enableCaching: true,
  cacheTTLMinutes: 15
};

// Simple in-memory cache
const contextCache = new Map<string, { context: HistoricalContext; timestamp: number }>();

export class ContextManager {
  private config: ContextConfig;

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Retrieve relevant historical context for a work item
   */
  async getContextForWorkItem(workItemId: string): Promise<HistoricalContext> {
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedContext(workItemId);
      if (cached) {
        logger.debug('Using cached context', { workItemId });
        return cached;
      }
    }

    logger.info('Building historical context', { workItemId });
    const startTime = Date.now();

    const workItem = getWorkItem(workItemId);
    if (!workItem) {
      throw new Error(`Work item ${workItemId} not found`);
    }

    // Get work item history
    const history = getWorkItemHistory(workItemId);
    
    // Get related items (parent, children, siblings)
    const relatedItems = this.getRelatedWorkItems(workItem);
    
    // Analyze patterns
    const successPatterns = this.extractSuccessPatterns(workItem, history);
    const errorPatterns = this.extractErrorPatterns(workItem, history);
    
    // Get agent performance metrics
    const agentPerformance = this.getAgentPerformanceMetrics(workItem.type);
    
    // Filter and score history by relevance
    const relevantHistory = this.scoreAndFilterHistory(history, workItem);

    const context: HistoricalContext = {
      workItemId,
      relevantHistory,
      relatedItems,
      successPatterns,
      errorPatterns,
      agentPerformance
    };

    // Cache the context
    if (this.config.enableCaching) {
      this.cacheContext(workItemId, context);
    }

    const duration = Date.now() - startTime;
    logger.info('Historical context built', { workItemId, duration, historyCount: relevantHistory.length });

    return context;
  }

  /**
   * Get context for a specific agent type
   */
  async getContextForAgent(agentType: string, workItemId?: string): Promise<string> {
    const baseContext = workItemId ? await this.getContextForWorkItem(workItemId) : null;
    
    // Build agent-specific context string
    let contextStr = '';
    
    if (baseContext) {
      // Add relevant history
      if (baseContext.relevantHistory.length > 0) {
        contextStr += '\nRELEVANT HISTORY:\n';
        contextStr += baseContext.relevantHistory
          .slice(0, this.config.maxHistoryItems)
          .map(h => `- ${h.created_at}: ${h.action} by ${h.created_by}: ${h.content}`)
          .join('\n');
      }
      
      // Add success patterns
      if (baseContext.successPatterns.length > 0) {
        contextStr += '\n\nSUCCESS PATTERNS:\n';
        contextStr += baseContext.successPatterns.map(p => `- ${p}`).join('\n');
      }
      
      // Add error patterns to avoid
      if (baseContext.errorPatterns.length > 0) {
        contextStr += '\n\nCOMMON ERRORS TO AVOID:\n';
        contextStr += baseContext.errorPatterns.map(p => `- ${p}`).join('\n');
      }
    }
    
    // Add agent performance metrics
    const metrics = this.getAgentPerformanceMetrics(agentType).get(agentType);
    if (metrics) {
      contextStr += `\n\nAGENT PERFORMANCE METRICS (${agentType}):\n`;
      contextStr += `- Success rate: ${(metrics.successRate * 100).toFixed(1)}%\n`;
      contextStr += `- Average execution time: ${metrics.averageExecutionTime}s\n`;
      if (metrics.commonErrors.length > 0) {
        contextStr += `- Common errors: ${metrics.commonErrors.join(', ')}\n`;
      }
    }
    
    return contextStr;
  }

  private getRelatedWorkItems(workItem: WorkItem): WorkItem[] {
    const related: WorkItem[] = [];
    
    // Add parent if exists
    if (workItem.parent_id) {
      const parent = getWorkItem(workItem.parent_id);
      if (parent) related.push(parent);
    }
    
    // Add children
    const children = getChildWorkItems(workItem.id);
    related.push(...children);
    
    // Add siblings (same parent)
    if (workItem.parent_id) {
      const siblings = getChildWorkItems(workItem.parent_id)
        .filter(w => w.id !== workItem.id);
      related.push(...siblings);
    }
    
    return related.slice(0, this.config.maxRelatedItems);
  }

  private extractSuccessPatterns(workItem: WorkItem, history: WorkHistory[]): string[] {
    const patterns: string[] = [];
    
    // Look for successful completions
    const successfulAgents = history
      .filter(h => h.action === 'agent_output' && h.content?.includes('"status":"completed"'))
      .map(h => h.created_by);
    
    if (successfulAgents.length > 0) {
      patterns.push(`Successfully completed by: ${[...new Set(successfulAgents)].join(', ')}`);
    }
    
    // Look for approved reviews
    const approvedReviews = history
      .filter(h => h.action === 'agent_output' && h.content?.includes('"status":"approved"'));
    
    if (approvedReviews.length > 0) {
      patterns.push(`Passed ${approvedReviews.length} quality reviews`);
    }
    
    return patterns;
  }

  private extractErrorPatterns(workItem: WorkItem, history: WorkHistory[]): string[] {
    const patterns: string[] = [];
    
    // Extract error messages
    const errors = history
      .filter(h => h.action === 'error')
      .map(h => {
        try {
          const error = JSON.parse(h.content || '{}');
          return `${error.errorType}: ${error.errorMessage}`;
        } catch {
          return h.content || 'Unknown error';
        }
      });
    
    // Deduplicate and return top patterns
    const uniqueErrors = [...new Set(errors)];
    return uniqueErrors.slice(0, 5);
  }

  private getAgentPerformanceMetrics(workItemType: string): Map<string, AgentPerformanceMetrics> {
    const db = getDatabase();
    const metrics = new Map<string, AgentPerformanceMetrics>();
    
    // Query for agent performance over the last week
    const query = `
      SELECT 
        wh.created_by as agent,
        wh.action,
        wh.content,
        wh.created_at,
        wi.type as work_item_type
      FROM work_history wh
      JOIN work_items wi ON wh.work_item_id = wi.id
      WHERE wh.created_at > datetime('now', '-${this.config.lookbackHours} hours')
        AND wh.created_by != 'system'
        AND (wi.type = ? OR ? = 'all')
      ORDER BY wh.created_at DESC
    `;
    
    const results = db.prepare(query).all(workItemType, workItemType) as any[];
    
    // Group by agent
    const agentData = new Map<string, any[]>();
    results.forEach(r => {
      if (!agentData.has(r.agent)) {
        agentData.set(r.agent, []);
      }
      agentData.get(r.agent)!.push(r);
    });
    
    // Calculate metrics for each agent
    agentData.forEach((data, agent) => {
      const successes = data.filter(d => 
        d.action === 'agent_output' && 
        (d.content?.includes('"status":"completed"') || d.content?.includes('"status":"approved"'))
      );
      
      const errors = data.filter(d => d.action === 'error');
      const successRate = data.length > 0 ? successes.length / data.length : 0;
      
      // Calculate average execution time (simplified - would need start/end times in real implementation)
      const avgTime = 120; // Placeholder - would calculate from actual timing data
      
      // Extract common errors
      const errorTypes = errors.map(e => {
        try {
          const parsed = JSON.parse(e.content || '{}');
          return parsed.errorType || 'Unknown';
        } catch {
          return 'Parse error';
        }
      });
      
      const commonErrors = [...new Set(errorTypes)].slice(0, 3);
      
      metrics.set(agent, {
        successRate,
        averageExecutionTime: avgTime,
        commonErrors,
        lastSuccess: successes.length > 0 ? new Date(successes[0].created_at) : undefined,
        lastFailure: errors.length > 0 ? new Date(errors[0].created_at) : undefined
      });
    });
    
    return metrics;
  }

  private scoreAndFilterHistory(history: WorkHistory[], workItem: WorkItem): WorkHistory[] {
    // Score each history item by relevance
    const scored = history.map(h => {
      let score = 0;
      
      // Recency score (more recent = higher score)
      const ageHours = (Date.now() - new Date(h.created_at).getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 100 - ageHours);
      
      // Action type score
      if (h.action === 'agent_output') score += 50;
      if (h.action === 'error') score += 40;
      if (h.action === 'decision') score += 30;
      
      // Content relevance (simplified - would use better NLP in production)
      if (h.content?.toLowerCase().includes(workItem.type)) score += 20;
      if (h.content?.toLowerCase().includes('success')) score += 15;
      if (h.content?.toLowerCase().includes('error')) score += 15;
      
      return { history: h, score };
    });
    
    // Sort by score and return top items
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxHistoryItems)
      .map(s => s.history);
  }

  private getCachedContext(workItemId: string): HistoricalContext | null {
    const cached = contextCache.get(workItemId);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTLMinutes * 60 * 1000) {
      contextCache.delete(workItemId);
      return null;
    }
    
    return cached.context;
  }

  private cacheContext(workItemId: string, context: HistoricalContext): void {
    contextCache.set(workItemId, {
      context,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (contextCache.size > 100) {
      const oldest = Array.from(contextCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      contextCache.delete(oldest[0]);
    }
  }

  /**
   * Clear the context cache
   */
  clearCache(): void {
    contextCache.clear();
    logger.info('Context cache cleared');
  }
}

// Export a default instance
export const defaultContextManager = new ContextManager();