import { Database } from '../database/connection';
import { Pattern, Review, WorkItemResult } from '../types/knowledge';
import { Logger } from '../utils/logger';

interface EffectivenessMetrics {
  successRate: number;
  avgQualityScore: number;
  reworkRate: number;
  reviewFeedbackScore: number;
  timeToCompletion: number;
  reusabilityScore: number;
}

interface PatternOutcome {
  patternId: string;
  workItemId: string;
  success: boolean;
  qualityScore: number;
  requiredRework: boolean;
  completionTime: number;
  reviewFeedback: string[];
}

export class EffectivenessScoringService {
  private db: Database;
  private logger: Logger;
  private readonly DECAY_FACTOR = 0.95; // Decay factor for time-based weighting
  private readonly MIN_OUTCOMES_FOR_SCORING = 3;

  constructor(db: Database) {
    this.db = db;
    this.logger = new Logger('EffectivenessScoringService');
  }

  async updatePatternEffectiveness(patternId: string): Promise<number> {
    try {
      const outcomes = await this.getPatternOutcomes(patternId);
      
      if (outcomes.length < this.MIN_OUTCOMES_FOR_SCORING) {
        this.logger.info(`Pattern ${patternId} has insufficient outcomes for scoring`);
        return 0.5; // Default neutral score
      }

      const metrics = this.calculateMetrics(outcomes);
      const effectivenessScore = this.computeEffectivenessScore(metrics);

      await this.saveEffectivenessScore(patternId, effectivenessScore);
      
      this.logger.info(`Updated effectiveness score for pattern ${patternId}: ${effectivenessScore}`);
      return effectivenessScore;
    } catch (error) {
      this.logger.error(`Failed to update pattern effectiveness: ${error}`);
      throw error;
    }
  }

  async batchUpdateEffectiveness(): Promise<void> {
    this.logger.info('Starting batch effectiveness update');

    const patterns = await this.db.all(
      'SELECT id FROM patterns WHERE usage_count > 0'
    );

    let updated = 0;
    for (const pattern of patterns) {
      try {
        await this.updatePatternEffectiveness(pattern.id);
        updated++;
      } catch (error) {
        this.logger.error(`Failed to update pattern ${pattern.id}: ${error}`);
      }
    }

    this.logger.info(`Batch update completed. Updated ${updated} patterns`);
  }

  private async getPatternOutcomes(patternId: string): Promise<PatternOutcome[]> {
    const query = `
      SELECT 
        pwi.pattern_id,
        pwi.work_item_id,
        wir.success,
        wir.error_message,
        r.quality_score,
        r.feedback,
        r.suggestions,
        wi.created_at,
        wi.completed_at,
        (
          SELECT COUNT(*) 
          FROM work_item_results wir2 
          WHERE wir2.work_item_id = wi.id
        ) as attempt_count
      FROM pattern_work_items pwi
      JOIN work_items wi ON pwi.work_item_id = wi.id
      LEFT JOIN work_item_results wir ON wi.id = wir.work_item_id
      LEFT JOIN reviews r ON wi.id = r.work_item_id
      WHERE pwi.pattern_id = ?
      ORDER BY wi.completed_at DESC
    `;

    const results = await this.db.all(query, [patternId]);

    return results.map(r => ({
      patternId: r.pattern_id,
      workItemId: r.work_item_id,
      success: r.success === 1,
      qualityScore: r.quality_score || 0,
      requiredRework: r.attempt_count > 1,
      completionTime: this.calculateCompletionTime(r.created_at, r.completed_at),
      reviewFeedback: this.parseReviewFeedback(r.feedback, r.suggestions)
    }));
  }

  private calculateMetrics(outcomes: PatternOutcome[]): EffectivenessMetrics {
    const recentOutcomes = this.applyTimeDecay(outcomes);

    const successRate = this.calculateSuccessRate(recentOutcomes);
    const avgQualityScore = this.calculateAverageQualityScore(recentOutcomes);
    const reworkRate = this.calculateReworkRate(recentOutcomes);
    const reviewFeedbackScore = this.calculateReviewFeedbackScore(recentOutcomes);
    const timeToCompletion = this.calculateAverageCompletionTime(recentOutcomes);
    const reusabilityScore = this.calculateReusabilityScore(outcomes);

    return {
      successRate,
      avgQualityScore,
      reworkRate,
      reviewFeedbackScore,
      timeToCompletion,
      reusabilityScore
    };
  }

  private applyTimeDecay(outcomes: PatternOutcome[]): PatternOutcome[] {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    return outcomes.map((outcome, index) => {
      // Apply exponential decay based on recency
      const age = index; // Already sorted by date DESC
      const weight = Math.pow(this.DECAY_FACTOR, age);
      
      // Clone outcome with weighted scores
      return {
        ...outcome,
        qualityScore: outcome.qualityScore * weight
      };
    });
  }

  private calculateSuccessRate(outcomes: PatternOutcome[]): number {
    if (outcomes.length === 0) return 0;
    
    const successful = outcomes.filter(o => o.success).length;
    return successful / outcomes.length;
  }

  private calculateAverageQualityScore(outcomes: PatternOutcome[]): number {
    const validScores = outcomes.filter(o => o.qualityScore > 0);
    if (validScores.length === 0) return 0;
    
    const sum = validScores.reduce((acc, o) => acc + o.qualityScore, 0);
    return sum / validScores.length;
  }

  private calculateReworkRate(outcomes: PatternOutcome[]): number {
    if (outcomes.length === 0) return 0;
    
    const reworked = outcomes.filter(o => o.requiredRework).length;
    return reworked / outcomes.length;
  }

  private calculateReviewFeedbackScore(outcomes: PatternOutcome[]): number {
    let totalScore = 0;
    let count = 0;

    for (const outcome of outcomes) {
      const score = this.scoreFeedback(outcome.reviewFeedback);
      if (score !== null) {
        totalScore += score;
        count++;
      }
    }

    return count > 0 ? totalScore / count : 0.5;
  }

  private scoreFeedback(feedback: string[]): number | null {
    if (feedback.length === 0) return null;

    // Positive indicators
    const positiveKeywords = [
      'excellent', 'great', 'good', 'well', 'efficient', 'clean',
      'robust', 'scalable', 'maintainable', 'clear', 'effective'
    ];

    // Negative indicators
    const negativeKeywords = [
      'poor', 'bad', 'inefficient', 'unclear', 'complex', 'brittle',
      'unmaintainable', 'slow', 'buggy', 'incorrect', 'fails'
    ];

    let score = 0.5; // Neutral baseline

    const feedbackText = feedback.join(' ').toLowerCase();

    for (const keyword of positiveKeywords) {
      if (feedbackText.includes(keyword)) {
        score += 0.05;
      }
    }

    for (const keyword of negativeKeywords) {
      if (feedbackText.includes(keyword)) {
        score -= 0.05;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateAverageCompletionTime(outcomes: PatternOutcome[]): number {
    const validTimes = outcomes.filter(o => o.completionTime > 0);
    if (validTimes.length === 0) return 1; // Neutral score

    const avgTime = validTimes.reduce((acc, o) => acc + o.completionTime, 0) / validTimes.length;
    
    // Convert to score (faster is better)
    // Assume 1 hour is excellent (1.0), 8 hours is poor (0.0)
    const hours = avgTime / (60 * 60 * 1000);
    return Math.max(0, Math.min(1, 1 - (hours - 1) / 7));
  }

  private calculateReusabilityScore(outcomes: PatternOutcome[]): number {
    // Higher usage with consistent success indicates good reusability
    const uniqueWorkItems = new Set(outcomes.map(o => o.workItemId)).size;
    const consistencyScore = this.calculateConsistencyScore(outcomes);
    
    // Normalize to 0-1 range
    const usageScore = Math.min(1, uniqueWorkItems / 10);
    
    return (usageScore + consistencyScore) / 2;
  }

  private calculateConsistencyScore(outcomes: PatternOutcome[]): number {
    if (outcomes.length < 2) return 0.5;

    // Calculate variance in quality scores
    const scores = outcomes.map(o => o.qualityScore).filter(s => s > 0);
    if (scores.length < 2) return 0.5;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
    
    // Lower variance = higher consistency
    // Variance of 0 = perfect consistency (1.0)
    // Variance of 0.25 = poor consistency (0.0)
    return Math.max(0, 1 - variance * 4);
  }

  private computeEffectivenessScore(metrics: EffectivenessMetrics): number {
    // Weighted combination of metrics
    const weights = {
      successRate: 0.25,
      avgQualityScore: 0.25,
      reworkRate: 0.15, // Negative metric
      reviewFeedbackScore: 0.15,
      timeToCompletion: 0.10,
      reusabilityScore: 0.10
    };

    let score = 0;
    score += metrics.successRate * weights.successRate;
    score += metrics.avgQualityScore * weights.avgQualityScore;
    score += (1 - metrics.reworkRate) * weights.reworkRate; // Invert negative metric
    score += metrics.reviewFeedbackScore * weights.reviewFeedbackScore;
    score += metrics.timeToCompletion * weights.timeToCompletion;
    score += metrics.reusabilityScore * weights.reusabilityScore;

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  private calculateCompletionTime(createdAt: string, completedAt: string): number {
    if (!createdAt || !completedAt) return 0;
    
    const start = new Date(createdAt).getTime();
    const end = new Date(completedAt).getTime();
    
    return end - start;
  }

  private parseReviewFeedback(feedback: string | null, suggestions: string | null): string[] {
    const result: string[] = [];
    
    if (feedback) result.push(feedback);
    if (suggestions) result.push(suggestions);
    
    return result;
  }

  private async saveEffectivenessScore(patternId: string, score: number): Promise<void> {
    await this.db.run(
      `UPDATE patterns 
       SET effectiveness_score = ?, updated_at = datetime('now') 
       WHERE id = ?`,
      [score, patternId]
    );
  }

  async analyzePatternTrends(): Promise<any> {
    const query = `
      SELECT 
        p.id,
        p.pattern_type,
        p.agent_role,
        p.effectiveness_score,
        p.usage_count,
        p.created_at,
        COUNT(DISTINCT pwi.work_item_id) as application_count,
        AVG(r.quality_score) as avg_quality,
        SUM(CASE WHEN wir.success = 1 THEN 1 ELSE 0 END) as success_count
      FROM patterns p
      LEFT JOIN pattern_work_items pwi ON p.id = pwi.pattern_id
      LEFT JOIN work_item_results wir ON pwi.work_item_id = wir.work_item_id
      LEFT JOIN reviews r ON pwi.work_item_id = r.work_item_id
      GROUP BY p.id
      ORDER BY p.effectiveness_score DESC
    `;

    const trends = await this.db.all(query);

    return {
      topPerformers: trends.slice(0, 10),
      underperformers: trends.filter(t => t.effectiveness_score < 0.4),
      mostUsed: trends.sort((a, b) => b.usage_count - a.usage_count).slice(0, 10),
      byType: this.groupByType(trends),
      byRole: this.groupByRole(trends)
    };
  }

  private groupByType(patterns: any[]): any {
    const grouped: any = {};
    
    for (const pattern of patterns) {
      if (!grouped[pattern.pattern_type]) {
        grouped[pattern.pattern_type] = {
          count: 0,
          avgEffectiveness: 0,
          totalUsage: 0
        };
      }
      
      grouped[pattern.pattern_type].count++;
      grouped[pattern.pattern_type].avgEffectiveness += pattern.effectiveness_score;
      grouped[pattern.pattern_type].totalUsage += pattern.usage_count;
    }

    // Calculate averages
    for (const type in grouped) {
      grouped[type].avgEffectiveness /= grouped[type].count;
    }

    return grouped;
  }

  private groupByRole(patterns: any[]): any {
    const grouped: any = {};
    
    for (const pattern of patterns) {
      if (!grouped[pattern.agent_role]) {
        grouped[pattern.agent_role] = {
          count: 0,
          avgEffectiveness: 0,
          totalUsage: 0
        };
      }
      
      grouped[pattern.agent_role].count++;
      grouped[pattern.agent_role].avgEffectiveness += pattern.effectiveness_score;
      grouped[pattern.agent_role].totalUsage += pattern.usage_count;
    }

    // Calculate averages
    for (const role in grouped) {
      grouped[role].avgEffectiveness /= grouped[role].count;
    }

    return grouped;
  }
}