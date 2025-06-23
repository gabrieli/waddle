import { 
  Pattern, 
  ADR, 
  Review,
  PatternFilter,
  ADRStatus
} from '../types/knowledge.js';
import { AgentRole, WorkItemType } from '../types/index.js';
import { 
  getPatternsByFilter,
  getADRsByStatus,
  getReviewsByStatus,
  incrementPatternUsage
} from '../database/knowledge.js';
import { getLogger } from '../utils/logger.js';
import { ContextCache } from './context-cache.js';

const logger = getLogger();

export interface RetrievalContext {
  currentTask: string;
  agentRole: AgentRole;
  workItemType: WorkItemType;
  workItemId?: string;
  parentContext?: string;
  recentHistory?: string[];
}

export interface RetrievalOptions {
  maxResults?: number;
  minRelevanceScore?: number;
  includeEmbeddings?: boolean;
  patternTypes?: string[];
  boostEffectiveness?: boolean;
}

export interface ScoredItem {
  id: string;
  type: 'pattern' | 'adr' | 'review';
  content: string;
  relevanceScore: number;
  metadata: Record<string, any>;
}

export interface ScoredKnowledge {
  patterns: ScoredItem[];
  adrs: ScoredItem[];
  reviews: ScoredItem[];
}

export class ContextRetrievalService {
  private readonly stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were',
    'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'should', 'could', 'may', 'might', 'must', 'can', 'shall', 'to', 'of',
    'in', 'for', 'with', 'by', 'from', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'that', 'this', 'these', 'those'
  ]);
  
  private cache: ContextCache;
  
  constructor(cacheConfig?: any) {
    this.cache = new ContextCache(cacheConfig);
  }

  calculateRelevanceScore(knowledgeContent: string, context: RetrievalContext): number {
    const contentLower = knowledgeContent.toLowerCase();
    const taskLower = context.currentTask.toLowerCase();
    
    // Extract keywords from the task
    const taskKeywords = this.extractKeywords(taskLower);
    const contentKeywords = this.extractKeywords(contentLower);
    
    // Calculate keyword overlap
    let matchCount = 0;
    let totalRelevantKeywords = taskKeywords.size;
    
    for (const keyword of taskKeywords) {
      if (contentKeywords.has(keyword) || contentLower.includes(keyword)) {
        matchCount++;
      }
    }
    
    // Base score from keyword matching
    let score = totalRelevantKeywords > 0 ? matchCount / totalRelevantKeywords : 0;
    
    // Boost score if agent role is mentioned
    if (context.agentRole && contentLower.includes(context.agentRole.toLowerCase())) {
      score += 0.2;
    }
    
    // Boost score if work item type is relevant
    if (context.workItemType && contentLower.includes(context.workItemType.toLowerCase())) {
      score += 0.1;
    }
    
    // Check for semantic similarity with common patterns
    if (this.hasSemanticSimilarity(taskLower, contentLower)) {
      score += 0.3;
    }
    
    // Normalize score to 0-1 range
    return Math.min(1.0, Math.max(0.0, score));
  }

  private extractKeywords(text: string): Set<string> {
    // Simple keyword extraction: split by non-word characters and filter
    const words = text.split(/\W+/)
      .filter(word => word.length > 2)
      .filter(word => !this.stopWords.has(word));
    
    return new Set(words);
  }

  private hasSemanticSimilarity(task: string, content: string): boolean {
    // Simple semantic patterns
    const patterns = [
      { task: /auth|login|security|token|jwt/i, content: /auth|login|security|token|jwt|password|credential/i },
      { task: /api|endpoint|rest|http/i, content: /api|endpoint|rest|http|route|request|response/i },
      { task: /database|query|sql|orm/i, content: /database|query|sql|orm|migration|schema/i },
      { task: /test|testing|unit|integration/i, content: /test|testing|unit|integration|mock|assert/i },
      { task: /error|exception|handle|catch/i, content: /error|exception|handle|catch|retry|fallback/i },
      { task: /review|code review|quality/i, content: /review|code review|quality|feedback|suggestion/i }
    ];
    
    for (const pattern of patterns) {
      if (pattern.task.test(task) && pattern.content.test(content)) {
        return true;
      }
    }
    
    return false;
  }

  retrieveRelevantContext(
    context: RetrievalContext, 
    options: RetrievalOptions = {}
  ): ScoredKnowledge {
    const {
      maxResults = 10,
      minRelevanceScore = 0.1,
      boostEffectiveness = true
    } = options;

    // Check cache first
    const cacheKey = this.cache.generateKey(
      context.agentRole,
      context.workItemId || 'no-item',
      context.currentTask
    );
    
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug('Using cached context', {
        agentRole: context.agentRole,
        workItemId: context.workItemId
      });
      return cached;
    }

    logger.info('Retrieving relevant context', {
      agentRole: context.agentRole,
      taskPreview: context.currentTask.substring(0, 50) + '...'
    });

    // Retrieve patterns
    const patterns = this.retrievePatterns(context, options);
    
    // Retrieve ADRs
    const adrs = this.retrieveADRs(context);
    
    // Retrieve reviews
    const reviews = this.retrieveReviews(context);
    
    // Combine and sort all items by relevance
    const allItems = [...patterns, ...adrs, ...reviews];
    allItems.sort((a, b) => {
      let scoreA = a.relevanceScore;
      let scoreB = b.relevanceScore;
      
      // Boost by effectiveness if enabled
      if (boostEffectiveness) {
        if (a.type === 'pattern' && a.metadata.effectiveness_score) {
          scoreA *= (1 + a.metadata.effectiveness_score * 0.5);
        }
        if (b.type === 'pattern' && b.metadata.effectiveness_score) {
          scoreB *= (1 + b.metadata.effectiveness_score * 0.5);
        }
      }
      
      return scoreB - scoreA;
    });
    
    // Apply filters and limits
    const filteredItems = allItems
      .filter(item => item.relevanceScore >= minRelevanceScore)
      .slice(0, maxResults);
    
    // Track pattern usage
    filteredItems
      .filter(item => item.type === 'pattern')
      .forEach(item => incrementPatternUsage(item.id));
    
    // Separate by type for return
    const result: ScoredKnowledge = {
      patterns: filteredItems.filter(item => item.type === 'pattern'),
      adrs: filteredItems.filter(item => item.type === 'adr'),
      reviews: filteredItems.filter(item => item.type === 'review')
    };

    logger.info('Context retrieval complete', {
      patternsFound: result.patterns.length,
      adrsFound: result.adrs.length,
      reviewsFound: result.reviews.length
    });
    
    // Cache the result
    this.cache.set(cacheKey, result);

    return result;
  }

  private retrievePatterns(
    context: RetrievalContext, 
    options: RetrievalOptions
  ): ScoredItem[] {
    const filter: PatternFilter = {
      agent_role: context.agentRole,
      include_embeddings: false
    };

    const patterns = getPatternsByFilter(filter);
    
    return patterns.map(pattern => {
      const content = `${pattern.context}\nSolution: ${pattern.solution}`;
      const relevanceScore = this.calculateRelevanceScore(content, context);
      
      return {
        id: pattern.id,
        type: 'pattern' as const,
        content,
        relevanceScore,
        metadata: {
          pattern_type: pattern.pattern_type,
          effectiveness_score: pattern.effectiveness_score,
          usage_count: pattern.usage_count
        }
      };
    });
  }

  private retrieveADRs(context: RetrievalContext): ScoredItem[] {
    const acceptedADRs = getADRsByStatus('accepted');
    
    return acceptedADRs.map(adr => {
      const content = `${adr.title}\nContext: ${adr.context}\nDecision: ${adr.decision}`;
      const relevanceScore = this.calculateRelevanceScore(content, context);
      
      return {
        id: adr.id,
        type: 'adr' as const,
        content,
        relevanceScore,
        metadata: {
          status: adr.status,
          created_by: adr.created_by,
          consequences: adr.consequences
        }
      };
    });
  }

  private retrieveReviews(context: RetrievalContext): ScoredItem[] {
    const approvedReviews = getReviewsByStatus('approved');
    
    return approvedReviews
      .filter(review => review.reviewer_role === context.agentRole || 
                       review.review_type === 'architecture')
      .map(review => {
        const content = `${review.feedback}\nSuggestions: ${review.suggestions || 'None'}`;
        const relevanceScore = this.calculateRelevanceScore(content, context);
        
        return {
          id: review.id,
          type: 'review' as const,
          content,
          relevanceScore,
          metadata: {
            review_type: review.review_type,
            quality_score: review.quality_score,
            reviewer_role: review.reviewer_role
          }
        };
      });
  }

  formatContextForPrompt(knowledge: ScoredKnowledge): string {
    if (knowledge.patterns.length === 0 && 
        knowledge.adrs.length === 0 && 
        knowledge.reviews.length === 0) {
      return '';
    }

    const sections: string[] = [];
    
    sections.push('## Historical Context\n');
    sections.push('The following relevant information from previous work may help inform your decisions:\n');

    if (knowledge.patterns.length > 0) {
      sections.push('### Patterns\n');
      knowledge.patterns.forEach((pattern, index) => {
        sections.push(`${index + 1}. [Relevance: ${(pattern.relevanceScore * 100).toFixed(0)}%] ${pattern.content}`);
        if (pattern.metadata.effectiveness_score) {
          sections.push(`   Effectiveness: ${(pattern.metadata.effectiveness_score * 100).toFixed(0)}%\n`);
        }
      });
      sections.push('');
    }

    if (knowledge.adrs.length > 0) {
      sections.push('### Architecture Decisions\n');
      knowledge.adrs.forEach((adr, index) => {
        sections.push(`${index + 1}. [Relevance: ${(adr.relevanceScore * 100).toFixed(0)}%] ${adr.content}\n`);
      });
      sections.push('');
    }

    if (knowledge.reviews.length > 0) {
      sections.push('### Review Insights\n');
      knowledge.reviews.forEach((review, index) => {
        sections.push(`${index + 1}. [Relevance: ${(review.relevanceScore * 100).toFixed(0)}%] ${review.content}\n`);
      });
    }

    return sections.join('\n');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}