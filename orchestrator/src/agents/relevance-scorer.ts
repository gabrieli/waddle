import { WorkItem, WorkHistory } from '../types/index.js';

export interface ScoredItem<T> {
  item: T;
  score: number;
  reasons: string[];
}

export interface RelevanceWeights {
  recency: number;
  actionType: number;
  agentType: number;
  contentSimilarity: number;
  errorRelevance: number;
  successRelevance: number;
  relatedWorkItem: number;
}

const DEFAULT_WEIGHTS: RelevanceWeights = {
  recency: 0.25,
  actionType: 0.20,
  agentType: 0.15,
  contentSimilarity: 0.15,
  errorRelevance: 0.10,
  successRelevance: 0.10,
  relatedWorkItem: 0.05
};

export class RelevanceScorer {
  private weights: RelevanceWeights;

  constructor(weights: Partial<RelevanceWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Score work history items by relevance to current work item and agent
   */
  scoreHistory(
    history: WorkHistory[],
    workItem: WorkItem,
    currentAgent: string,
    relatedItemIds: string[] = []
  ): ScoredItem<WorkHistory>[] {
    return history.map(h => {
      const scores: { [key: string]: number } = {};
      const reasons: string[] = [];

      // Recency score (exponential decay)
      const ageHours = (Date.now() - new Date(h.created_at).getTime()) / (1000 * 60 * 60);
      scores.recency = Math.exp(-ageHours / 168) * 100; // 1 week half-life
      if (ageHours < 24) reasons.push('Recent activity');

      // Action type score
      scores.actionType = this.scoreActionType(h.action, workItem.type);
      if (scores.actionType > 50) reasons.push(`Relevant action: ${h.action}`);

      // Agent type score
      scores.agentType = this.scoreAgentRelevance(h.created_by, currentAgent);
      if (h.created_by === currentAgent) reasons.push('Same agent type');

      // Content similarity score
      scores.contentSimilarity = this.scoreContentSimilarity(h.content || '', workItem);
      if (scores.contentSimilarity > 50) reasons.push('Similar content');

      // Error relevance (if history contains errors)
      if (h.action === 'error') {
        scores.errorRelevance = this.scoreErrorRelevance(h.content || '', workItem.type);
        if (scores.errorRelevance > 50) reasons.push('Relevant error pattern');
      } else {
        scores.errorRelevance = 0;
      }

      // Success relevance
      if (h.content?.includes('"status":"completed"') || h.content?.includes('"status":"approved"')) {
        scores.successRelevance = 80;
        reasons.push('Successful outcome');
      } else {
        scores.successRelevance = 0;
      }

      // Related work item bonus
      if (relatedItemIds.includes(h.work_item_id)) {
        scores.relatedWorkItem = 100;
        reasons.push('Related work item');
      } else {
        scores.relatedWorkItem = 0;
      }

      // Calculate weighted total
      const totalScore = Object.entries(scores).reduce((sum, [key, value]) => {
        return sum + (value * this.weights[key as keyof RelevanceWeights]);
      }, 0);

      return {
        item: h,
        score: Math.min(100, totalScore),
        reasons
      };
    });
  }

  /**
   * Score work items by relevance to current work item
   */
  scoreWorkItems(
    items: WorkItem[],
    currentItem: WorkItem,
    currentAgent: string
  ): ScoredItem<WorkItem>[] {
    return items.map(item => {
      const scores: { [key: string]: number } = {};
      const reasons: string[] = [];

      // Direct relationship score
      if (item.id === currentItem.parent_id) {
        scores.relationship = 100;
        reasons.push('Parent item');
      } else if (item.parent_id === currentItem.id) {
        scores.relationship = 90;
        reasons.push('Child item');
      } else if (item.parent_id === currentItem.parent_id && item.id !== currentItem.id) {
        scores.relationship = 70;
        reasons.push('Sibling item');
      } else {
        scores.relationship = 0;
      }

      // Type similarity
      if (item.type === currentItem.type) {
        scores.typeSimilarity = 60;
        reasons.push('Same type');
      } else {
        scores.typeSimilarity = 20;
      }

      // Status relevance
      scores.statusRelevance = this.scoreStatusRelevance(item.status, currentItem.status);
      if (scores.statusRelevance > 50) reasons.push(`Relevant status: ${item.status}`);

      // Title/description similarity
      scores.contentSimilarity = this.calculateTextSimilarity(
        `${item.title} ${item.description || ''}`,
        `${currentItem.title} ${currentItem.description || ''}`
      ) * 100;
      if (scores.contentSimilarity > 30) reasons.push('Similar content');

      // Calculate total (simple average for work items)
      const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

      return {
        item,
        score: Math.min(100, totalScore),
        reasons
      };
    });
  }

  private scoreActionType(action: string, workItemType: string): number {
    const scores: { [key: string]: number } = {
      'agent_output': 70,
      'error': 60,
      'decision': 50,
      'status_change': 40
    };

    let score = scores[action] || 30;

    // Boost score for specific combinations
    if (action === 'error' && workItemType === 'bug') score += 20;
    if (action === 'agent_output' && workItemType === 'story') score += 10;

    return score;
  }

  private scoreAgentRelevance(historyAgent: string, currentAgent: string): number {
    if (historyAgent === currentAgent) return 100;
    
    // Similar agent types get partial score
    const agentGroups: { [key: string]: string[] } = {
      'technical': ['architect', 'developer', 'bug-buster'],
      'quality': ['reviewer', 'code-quality-reviewer'],
      'management': ['manager']
    };

    for (const group of Object.values(agentGroups)) {
      if (group.includes(historyAgent) && group.includes(currentAgent)) {
        return 60;
      }
    }

    return 20;
  }

  private scoreContentSimilarity(content: string, workItem: WorkItem): number {
    const contentLower = content.toLowerCase();
    const titleWords = workItem.title.toLowerCase().split(/\s+/);
    const descWords = (workItem.description || '').toLowerCase().split(/\s+/);
    
    let matchCount = 0;
    let totalWords = titleWords.length + descWords.length;

    // Count word matches
    [...titleWords, ...descWords].forEach(word => {
      if (word.length > 3 && contentLower.includes(word)) {
        matchCount++;
      }
    });

    // Check for specific relevant patterns
    if (contentLower.includes(workItem.id.toLowerCase())) matchCount += 3;
    if (contentLower.includes(workItem.type)) matchCount += 2;

    return totalWords > 0 ? (matchCount / totalWords) * 100 : 0;
  }

  private scoreErrorRelevance(errorContent: string, workItemType: string): number {
    try {
      const error = JSON.parse(errorContent);
      
      // High relevance for same error types
      if (error.workItemType === workItemType) return 80;
      
      // Medium relevance for related agent errors
      const relatedAgents: { [key: string]: string[] } = {
        'story': ['developer', 'architect'],
        'bug': ['bug-buster', 'developer'],
        'epic': ['architect', 'manager']
      };

      if (relatedAgents[workItemType]?.includes(error.agentType)) return 60;

      return 30;
    } catch {
      return 20; // Low score for unparseable errors
    }
  }

  private scoreStatusRelevance(itemStatus: string, currentStatus: string): number {
    if (itemStatus === currentStatus) return 80;

    // Adjacent statuses are somewhat relevant
    const statusFlow = ['backlog', 'ready', 'in_progress', 'review', 'done'];
    const itemIndex = statusFlow.indexOf(itemStatus);
    const currentIndex = statusFlow.indexOf(currentStatus);

    if (Math.abs(itemIndex - currentIndex) === 1) return 50;

    return 20;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Filter and sort items by relevance score
   */
  filterByRelevance<T>(
    scoredItems: ScoredItem<T>[],
    minScore: number = 30,
    maxItems?: number
  ): ScoredItem<T>[] {
    let filtered = scoredItems
      .filter(item => item.score >= minScore)
      .sort((a, b) => b.score - a.score);

    if (maxItems) {
      filtered = filtered.slice(0, maxItems);
    }

    return filtered;
  }
}

export const defaultRelevanceScorer = new RelevanceScorer();