import { OrchestratorConfig } from '../orchestrator/config.js';
import { getLogger } from '../utils/logger.js';
import { addHistory } from '../database/utils.js';

const logger = getLogger();

export interface ABTestResult {
  variant: 'control' | 'treatment';
  enableContext: boolean;
  reason: string;
}

export interface ABTestMetrics {
  variant: string;
  workItemId: string;
  agentType: string;
  executionTimeMs: number;
  success: boolean;
  errorType?: string;
  contextSize?: number;
  timestamp: Date;
}

// Simple deterministic hash function for consistent A/B assignment
function simpleHash(str: string, seed: number = 0): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export class ABTestingManager {
  private metrics: ABTestMetrics[] = [];
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  /**
   * Determine if historical context should be enabled for a given work item
   */
  shouldEnableContext(workItemId: string, agentType: string): ABTestResult {
    // If A/B testing is not enabled, use the default config
    if (!this.config.abTesting?.enabled) {
      return {
        variant: 'control',
        enableContext: this.config.enableHistoricalContext !== false,
        reason: 'A/B testing disabled, using default configuration'
      };
    }

    // Use deterministic assignment based on work item ID
    const seed = this.config.abTesting.seed || 42;
    const hash = simpleHash(`${workItemId}-${agentType}`, seed);
    const percentage = (hash % 100) + 1; // 1-100

    const enableContext = percentage <= this.config.abTesting.contextEnabledPercent;

    logger.info('A/B test assignment', {
      workItemId,
      agentType,
      percentage,
      threshold: this.config.abTesting.contextEnabledPercent,
      enableContext,
      variant: enableContext ? 'treatment' : 'control'
    });

    // Record the A/B test assignment in work history (only if work item exists)
    try {
      addHistory(
        workItemId,
        'agent_output',
        JSON.stringify({
          abTest: true,
          variant: enableContext ? 'treatment' : 'control',
          contextEnabled: enableContext,
          percentage,
          threshold: this.config.abTesting.contextEnabledPercent
        }),
        `ab-test-${agentType}`
      );
    } catch (error) {
      // Ignore foreign key errors for demo/test work items
      logger.debug('Could not record A/B test assignment in history', { workItemId, error: error as Error });
    }

    return {
      variant: enableContext ? 'treatment' : 'control',
      enableContext,
      reason: `A/B test: ${percentage}% vs threshold ${this.config.abTesting.contextEnabledPercent}%`
    };
  }

  /**
   * Record metrics for A/B test analysis
   */
  recordMetrics(metrics: ABTestMetrics): void {
    this.metrics.push(metrics);
    
    logger.info('A/B test metrics recorded', {
      variant: metrics.variant,
      workItemId: metrics.workItemId,
      agentType: metrics.agentType,
      success: metrics.success,
      executionTimeMs: metrics.executionTimeMs,
      contextSize: metrics.contextSize
    });

    // Store metrics in work history for later analysis (only if work item exists)
    try {
      addHistory(
        metrics.workItemId,
        'agent_output',
        JSON.stringify({
          abTestMetrics: true,
          ...metrics
        }),
        `ab-metrics-${metrics.agentType}`
      );
    } catch (error) {
      // Ignore foreign key errors for demo/test work items
      logger.debug('Could not record A/B test metrics in history', { workItemId: metrics.workItemId, error: error as Error });
    }
  }

  /**
   * Get summary statistics for A/B test results
   */
  getSummaryStats(): {
    control: { count: number; successRate: number; avgExecutionTime: number };
    treatment: { count: number; successRate: number; avgExecutionTime: number; avgContextSize: number };
  } {
    const controlMetrics = this.metrics.filter(m => m.variant === 'control');
    const treatmentMetrics = this.metrics.filter(m => m.variant === 'treatment');

    const calculateStats = (metrics: ABTestMetrics[]) => {
      if (metrics.length === 0) {
        return { count: 0, successRate: 0, avgExecutionTime: 0, avgContextSize: 0 };
      }

      const successCount = metrics.filter(m => m.success).length;
      const totalExecutionTime = metrics.reduce((sum, m) => sum + m.executionTimeMs, 0);
      const totalContextSize = metrics.reduce((sum, m) => sum + (m.contextSize || 0), 0);

      return {
        count: metrics.length,
        successRate: successCount / metrics.length,
        avgExecutionTime: totalExecutionTime / metrics.length,
        avgContextSize: totalContextSize / metrics.length
      };
    };

    return {
      control: calculateStats(controlMetrics),
      treatment: calculateStats(treatmentMetrics)
    };
  }

  /**
   * Generate A/B test report
   */
  generateReport(): string {
    const stats = this.getSummaryStats();
    
    let report = 'A/B TEST REPORT\n';
    report += '===============\n\n';
    
    report += 'Control Group (No Context):\n';
    report += `  - Sample size: ${stats.control.count}\n`;
    report += `  - Success rate: ${(stats.control.successRate * 100).toFixed(1)}%\n`;
    report += `  - Avg execution time: ${stats.control.avgExecutionTime.toFixed(0)}ms\n\n`;
    
    report += 'Treatment Group (With Context):\n';
    report += `  - Sample size: ${stats.treatment.count}\n`;
    report += `  - Success rate: ${(stats.treatment.successRate * 100).toFixed(1)}%\n`;
    report += `  - Avg execution time: ${stats.treatment.avgExecutionTime.toFixed(0)}ms\n`;
    report += `  - Avg context size: ${stats.treatment.avgContextSize.toFixed(0)} chars\n\n`;
    
    if (stats.control.count > 0 && stats.treatment.count > 0) {
      const successRateImprovement = 
        ((stats.treatment.successRate - stats.control.successRate) / stats.control.successRate) * 100;
      const executionTimeChange = 
        ((stats.treatment.avgExecutionTime - stats.control.avgExecutionTime) / stats.control.avgExecutionTime) * 100;
      
      report += 'Impact Analysis:\n';
      report += `  - Success rate change: ${successRateImprovement > 0 ? '+' : ''}${successRateImprovement.toFixed(1)}%\n`;
      report += `  - Execution time change: ${executionTimeChange > 0 ? '+' : ''}${executionTimeChange.toFixed(1)}%\n`;
      
      // Statistical significance would be calculated here in a real implementation
      report += '\nNote: Statistical significance testing not implemented in this prototype.\n';
    }
    
    return report;
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): ABTestMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
    logger.info('A/B test metrics cleared');
  }
}

// Export a singleton instance
let abTestingManager: ABTestingManager | null = null;

export function getABTestingManager(config: OrchestratorConfig): ABTestingManager {
  if (!abTestingManager) {
    abTestingManager = new ABTestingManager(config);
  }
  return abTestingManager;
}