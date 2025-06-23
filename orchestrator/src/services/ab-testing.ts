import { AgentRole } from '../types/index.js';
import { getLogger } from '../utils/logger.js';
import crypto from 'crypto';

const logger = getLogger();

export interface ABTestConfig {
  enabled: boolean;
  contextEnabledPercent: number;
  seed?: number;
}

export interface ABTestMetrics {
  variant: 'control' | 'treatment';
  agentRole: AgentRole | string;
  workItemId: string;
  executionTimeMs: number;
  success: boolean;
  errorType?: string;
  contextSize?: number;
  timestamp: Date;
}

export interface VariantAssignment {
  variant: 'control' | 'treatment';
  enableContext: boolean;
}

export interface VariantStats {
  count: number;
  successCount: number;
  totalExecutionTime: number;
  totalContextSize: number;
  contextSizeCount: number;
  errorCounts: Record<string, number>;
  successRate: number;
  avgExecutionTime: number;
  avgContextSize: number;
}

export interface ABTestStats {
  control: VariantStats;
  treatment: VariantStats;
}

export interface ImpactAnalysis {
  successRateImprovement: number;
  executionTimeImprovement: number;
  sampleSize: {
    control: number;
    treatment: number;
  };
  isSignificant: boolean;
  confidence: number;
}

export class ABTestingService {
  private config: ABTestConfig;
  private metrics: ABTestMetrics[] = [];
  private variantCache = new Map<string, VariantAssignment>();

  constructor(config: ABTestConfig) {
    this.config = config;
    logger.info('A/B testing service initialized', {
      enabled: config.enabled,
      contextEnabledPercent: config.contextEnabledPercent
    });
  }

  /**
   * Deterministically assign a variant based on work item ID
   */
  getVariant(agentRole: string, workItemId: string): VariantAssignment {
    if (!this.config.enabled) {
      return { variant: 'control', enableContext: false };
    }

    // Check cache
    const cacheKey = `${agentRole}:${workItemId}`;
    const cached = this.variantCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate deterministic hash
    const hashInput = this.config.seed 
      ? `${workItemId}:${this.config.seed}`
      : workItemId;
    
    const hash = crypto.createHash('sha256').update(hashInput).digest();
    const hashValue = hash.readUInt32BE(0);
    const percentage = (hashValue % 100) + 1;

    const enableContext = percentage <= this.config.contextEnabledPercent;
    const assignment: VariantAssignment = {
      variant: enableContext ? 'treatment' : 'control',
      enableContext
    };

    // Cache the assignment
    this.variantCache.set(cacheKey, assignment);

    logger.debug('Variant assigned', {
      agentRole,
      workItemId,
      variant: assignment.variant,
      enableContext: assignment.enableContext
    });

    return assignment;
  }

  /**
   * Record metrics for an execution
   */
  recordMetrics(metrics: ABTestMetrics): void {
    this.metrics.push(metrics);
    
    logger.info('A/B test metrics recorded', {
      variant: metrics.variant,
      agentRole: metrics.agentRole,
      workItemId: metrics.workItemId,
      success: metrics.success,
      executionTimeMs: metrics.executionTimeMs
    });
  }

  /**
   * Get aggregated statistics
   */
  getStats(): ABTestStats {
    const stats: ABTestStats = {
      control: this.calculateVariantStats('control'),
      treatment: this.calculateVariantStats('treatment')
    };

    return stats;
  }

  private calculateVariantStats(variant: 'control' | 'treatment'): VariantStats {
    const variantMetrics = this.metrics.filter(m => m.variant === variant);
    
    if (variantMetrics.length === 0) {
      return {
        count: 0,
        successCount: 0,
        totalExecutionTime: 0,
        totalContextSize: 0,
        contextSizeCount: 0,
        errorCounts: {},
        successRate: 0,
        avgExecutionTime: 0,
        avgContextSize: 0
      };
    }

    const successCount = variantMetrics.filter(m => m.success).length;
    const totalExecutionTime = variantMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0);
    
    const contextMetrics = variantMetrics.filter(m => m.contextSize !== undefined);
    const totalContextSize = contextMetrics.reduce((sum, m) => sum + (m.contextSize || 0), 0);
    
    const errorCounts: Record<string, number> = {};
    variantMetrics
      .filter(m => !m.success && m.errorType)
      .forEach(m => {
        errorCounts[m.errorType!] = (errorCounts[m.errorType!] || 0) + 1;
      });

    return {
      count: variantMetrics.length,
      successCount,
      totalExecutionTime,
      totalContextSize,
      contextSizeCount: contextMetrics.length,
      errorCounts,
      successRate: variantMetrics.length > 0 ? successCount / variantMetrics.length : 0,
      avgExecutionTime: variantMetrics.length > 0 ? totalExecutionTime / variantMetrics.length : 0,
      avgContextSize: contextMetrics.length > 0 ? totalContextSize / contextMetrics.length : 0
    };
  }

  /**
   * Calculate impact analysis between variants
   */
  getImpactAnalysis(): ImpactAnalysis {
    const stats = this.getStats();
    
    const successRateImprovement = stats.control.successRate > 0
      ? (stats.treatment.successRate - stats.control.successRate) / stats.control.successRate
      : 0;
    
    const executionTimeImprovement = stats.control.avgExecutionTime > 0
      ? (stats.treatment.avgExecutionTime - stats.control.avgExecutionTime) / stats.control.avgExecutionTime
      : 0;

    // Simple statistical significance check (would use proper stats library in production)
    const minSampleSize = 30;
    const isSignificant = 
      stats.control.count >= minSampleSize && 
      stats.treatment.count >= minSampleSize &&
      Math.abs(successRateImprovement) > 0.1; // 10% difference threshold

    // Simplified confidence calculation
    const sampleSizeFactor = Math.min(
      stats.control.count / 100,
      stats.treatment.count / 100,
      1
    );
    const effectSizeFactor = Math.min(Math.abs(successRateImprovement) * 5, 1);
    const confidence = sampleSizeFactor * effectSizeFactor;

    return {
      successRateImprovement,
      executionTimeImprovement,
      sampleSize: {
        control: stats.control.count,
        treatment: stats.treatment.count
      },
      isSignificant,
      confidence
    };
  }

  /**
   * Generate a comprehensive report
   */
  generateReport(): string {
    const stats = this.getStats();
    const impact = this.getImpactAnalysis();
    
    const lines = [
      '# A/B Test Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total Samples: ${this.metrics.length}`,
      '',
      '## Configuration',
      `- Context Enabled Percentage: ${this.config.contextEnabledPercent}%`,
      `- Test Status: ${this.config.enabled ? 'Active' : 'Disabled'}`,
      '',
      '## Control Group (No Context)',
      `- Sample Size: ${stats.control.count}`,
      `- Success Rate: ${(stats.control.successRate * 100).toFixed(1)}%`,
      `- Avg Execution Time: ${stats.control.avgExecutionTime.toFixed(0)}ms`,
      `- Errors: ${Object.entries(stats.control.errorCounts).map(([type, count]) => `${type}(${count})`).join(', ') || 'None'}`,
      '',
      '## Treatment Group (With Context)',
      `- Sample Size: ${stats.treatment.count}`,
      `- Success Rate: ${(stats.treatment.successRate * 100).toFixed(1)}%`,
      `- Avg Execution Time: ${stats.treatment.avgExecutionTime.toFixed(0)}ms`,
      `- Avg Context Size: ${stats.treatment.avgContextSize.toFixed(0)} bytes`,
      `- Errors: ${Object.entries(stats.treatment.errorCounts).map(([type, count]) => `${type}(${count})`).join(', ') || 'None'}`,
      '',
      '## Impact Analysis',
      `- Success Rate Change: ${impact.successRateImprovement >= 0 ? '+' : ''}${(impact.successRateImprovement * 100).toFixed(1)}%`,
      `- Execution Time Change: ${impact.executionTimeImprovement >= 0 ? '+' : ''}${(impact.executionTimeImprovement * 100).toFixed(1)}%`,
      `- Statistical Significance: ${impact.isSignificant ? 'Yes' : 'No'}`,
      `- Confidence Level: ${(impact.confidence * 100).toFixed(0)}%`,
      '',
      '## Recommendations',
    ];

    if (impact.isSignificant) {
      if (impact.successRateImprovement > 0.1) {
        lines.push('✅ Context injection shows significant improvement in success rates');
        lines.push('   Consider increasing the rollout percentage');
      } else if (impact.successRateImprovement < -0.1) {
        lines.push('⚠️  Context injection shows decreased success rates');
        lines.push('   Review context quality and relevance scoring');
      }
      
      if (impact.executionTimeImprovement > 0.2) {
        lines.push('⚠️  Context injection increases execution time significantly');
        lines.push('   Consider optimizing context retrieval and caching');
      }
    } else {
      lines.push('📊 Insufficient data for conclusive results');
      lines.push('   Continue collecting metrics');
    }

    return lines.join('\n');
  }

  /**
   * Export metrics for persistence
   */
  exportMetrics(): string {
    return JSON.stringify({
      config: this.config,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import metrics from persistence
   */
  importMetrics(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.metrics && Array.isArray(parsed.metrics)) {
        this.metrics = parsed.metrics.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        logger.info('Metrics imported', { count: this.metrics.length });
      }
    } catch (error) {
      logger.error('Failed to import metrics', error);
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.variantCache.clear();
    logger.info('A/B test metrics cleared');
  }
}