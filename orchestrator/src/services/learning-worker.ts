import { Database } from '../database/connection';
import { Logger } from '../utils/logger';
import { PatternExtractionService } from './pattern-extraction';
import { EffectivenessScoringService } from './effectiveness-scoring';
import { PatternCategorizationService } from './pattern-categorization';
import { PatternCleanupService } from './pattern-cleanup';

interface WorkerConfig {
  extractionInterval: number; // in milliseconds
  scoringInterval: number;
  cleanupInterval: number;
  enabled: boolean;
}

export class LearningWorker {
  private db: Database;
  private logger: Logger;
  private config: WorkerConfig;
  private extractionService: PatternExtractionService;
  private scoringService: EffectivenessScoringService;
  private categorizationService: PatternCategorizationService;
  private cleanupService: PatternCleanupService;
  private extractionTimer?: NodeJS.Timeout;
  private scoringTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private lastExtractionRun?: Date;
  private lastScoringRun?: Date;
  private lastCleanupRun?: Date;

  constructor(db: Database, config?: Partial<WorkerConfig>) {
    this.db = db;
    this.logger = new Logger('LearningWorker');
    this.config = {
      extractionInterval: 30 * 60 * 1000, // 30 minutes
      scoringInterval: 60 * 60 * 1000,    // 1 hour
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      enabled: true,
      ...config
    };

    this.extractionService = new PatternExtractionService(db);
    this.scoringService = new EffectivenessScoringService(db);
    this.categorizationService = new PatternCategorizationService(db);
    this.cleanupService = new PatternCleanupService(db);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Learning worker is already running');
      return;
    }

    if (!this.config.enabled) {
      this.logger.info('Learning worker is disabled');
      return;
    }

    this.logger.info('Starting learning worker');
    this.isRunning = true;

    // Run initial tasks
    await this.runExtractionCycle();
    await this.runScoringCycle();

    // Schedule recurring tasks
    this.scheduleExtractionTask();
    this.scheduleScoringTask();
    this.scheduleCleanupTask();

    this.logger.info('Learning worker started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Learning worker is not running');
      return;
    }

    this.logger.info('Stopping learning worker');
    this.isRunning = false;

    // Clear all timers
    if (this.extractionTimer) {
      clearInterval(this.extractionTimer);
      this.extractionTimer = undefined;
    }

    if (this.scoringTimer) {
      clearInterval(this.scoringTimer);
      this.scoringTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.logger.info('Learning worker stopped');
  }

  private scheduleExtractionTask(): void {
    this.extractionTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.runExtractionCycle();
      }
    }, this.config.extractionInterval);
  }

  private scheduleScoringTask(): void {
    this.scoringTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.runScoringCycle();
      }
    }, this.config.scoringInterval);
  }

  private scheduleCleanupTask(): void {
    this.cleanupTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.runCleanupCycle();
      }
    }, this.config.cleanupInterval);
  }

  private async runExtractionCycle(): Promise<void> {
    try {
      this.logger.info('Starting pattern extraction cycle');
      const startTime = Date.now();

      // Extract patterns from work completed since last run
      const patterns = await this.extractionService.extractPatternsFromCompletedWork(
        this.lastExtractionRun
      );

      if (patterns.length > 0) {
        // Categorize new patterns
        for (const pattern of patterns) {
          pattern.type = await this.categorizationService.categorizePattern(pattern);
          pattern.tags = await this.categorizationService.extractCategoryTags(pattern);
        }

        // Save new patterns
        await this.extractionService.saveExtractedPatterns(patterns);

        this.logger.info(`Extraction cycle completed. Found ${patterns.length} new patterns`);
      } else {
        this.logger.info('Extraction cycle completed. No new patterns found');
      }

      this.lastExtractionRun = new Date();
      
      // Log metrics
      const duration = Date.now() - startTime;
      await this.logCycleMetrics('extraction', {
        duration,
        patternsFound: patterns.length,
        timestamp: this.lastExtractionRun
      });

    } catch (error) {
      this.logger.error('Failed to run extraction cycle', error);
      await this.logCycleError('extraction', error);
    }
  }

  private async runScoringCycle(): Promise<void> {
    try {
      this.logger.info('Starting effectiveness scoring cycle');
      const startTime = Date.now();

      // Update effectiveness scores for all patterns
      await this.scoringService.batchUpdateEffectiveness();

      // Analyze trends
      const trends = await this.scoringService.analyzePatternTrends();
      
      this.logger.info('Scoring cycle completed', {
        topPerformers: trends.topPerformers.length,
        underperformers: trends.underperformers.length
      });

      this.lastScoringRun = new Date();

      // Log metrics
      const duration = Date.now() - startTime;
      await this.logCycleMetrics('scoring', {
        duration,
        patternsScored: trends.topPerformers.length + trends.underperformers.length,
        timestamp: this.lastScoringRun
      });

    } catch (error) {
      this.logger.error('Failed to run scoring cycle', error);
      await this.logCycleError('scoring', error);
    }
  }

  private async runCleanupCycle(): Promise<void> {
    try {
      this.logger.info('Starting cleanup cycle');
      const startTime = Date.now();

      // Clean up ineffective patterns
      const removedPatterns = await this.cleanupService.cleanupIneffectivePatterns();

      // Archive old patterns
      const archivedPatterns = await this.cleanupService.archiveOldPatterns();

      // Merge duplicate patterns
      const mergedPatterns = await this.cleanupService.mergeDuplicatePatterns();

      this.logger.info('Cleanup cycle completed', {
        removed: removedPatterns,
        archived: archivedPatterns,
        merged: mergedPatterns
      });

      this.lastCleanupRun = new Date();

      // Log metrics
      const duration = Date.now() - startTime;
      await this.logCycleMetrics('cleanup', {
        duration,
        patternsRemoved: removedPatterns,
        patternsArchived: archivedPatterns,
        patternsMerged: mergedPatterns,
        timestamp: this.lastCleanupRun
      });

    } catch (error) {
      this.logger.error('Failed to run cleanup cycle', error);
      await this.logCycleError('cleanup', error);
    }
  }

  private async logCycleMetrics(
    cycleType: string,
    metrics: Record<string, any>
  ): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO learning_metrics (
          cycle_type, metrics, created_at
        ) VALUES (?, ?, datetime('now'))`,
        [cycleType, JSON.stringify(metrics)]
      );
    } catch (error) {
      this.logger.error('Failed to log cycle metrics', error);
    }
  }

  private async logCycleError(
    cycleType: string,
    error: any
  ): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO learning_errors (
          cycle_type, error_message, stack_trace, created_at
        ) VALUES (?, ?, ?, datetime('now'))`,
        [
          cycleType,
          error.message || 'Unknown error',
          error.stack || ''
        ]
      );
    } catch (logError) {
      this.logger.error('Failed to log cycle error', logError);
    }
  }

  async getStatus(): Promise<any> {
    return {
      isRunning: this.isRunning,
      config: this.config,
      lastRuns: {
        extraction: this.lastExtractionRun,
        scoring: this.lastScoringRun,
        cleanup: this.lastCleanupRun
      },
      nextRuns: {
        extraction: this.getNextRunTime(this.lastExtractionRun, this.config.extractionInterval),
        scoring: this.getNextRunTime(this.lastScoringRun, this.config.scoringInterval),
        cleanup: this.getNextRunTime(this.lastCleanupRun, this.config.cleanupInterval)
      }
    };
  }

  private getNextRunTime(lastRun: Date | undefined, interval: number): Date | null {
    if (!this.isRunning) return null;
    if (!lastRun) return new Date();
    
    return new Date(lastRun.getTime() + interval);
  }

  async getMetrics(hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = await this.db.all(
      `SELECT cycle_type, metrics, created_at 
       FROM learning_metrics 
       WHERE created_at >= ? 
       ORDER BY created_at DESC`,
      [since.toISOString()]
    );

    const errors = await this.db.all(
      `SELECT cycle_type, error_message, created_at 
       FROM learning_errors 
       WHERE created_at >= ? 
       ORDER BY created_at DESC`,
      [since.toISOString()]
    );

    // Aggregate metrics by cycle type
    const aggregated: any = {
      extraction: { runs: 0, totalPatterns: 0, avgDuration: 0 },
      scoring: { runs: 0, totalScored: 0, avgDuration: 0 },
      cleanup: { runs: 0, totalCleaned: 0, avgDuration: 0 }
    };

    for (const metric of metrics) {
      const data = JSON.parse(metric.metrics);
      const type = metric.cycle_type;

      if (aggregated[type]) {
        aggregated[type].runs++;
        aggregated[type].avgDuration += data.duration;

        if (type === 'extraction') {
          aggregated[type].totalPatterns += data.patternsFound || 0;
        } else if (type === 'scoring') {
          aggregated[type].totalScored += data.patternsScored || 0;
        } else if (type === 'cleanup') {
          aggregated[type].totalCleaned += 
            (data.patternsRemoved || 0) + 
            (data.patternsArchived || 0) + 
            (data.patternsMerged || 0);
        }
      }
    }

    // Calculate averages
    for (const type in aggregated) {
      if (aggregated[type].runs > 0) {
        aggregated[type].avgDuration /= aggregated[type].runs;
      }
    }

    return {
      period: `Last ${hours} hours`,
      cycles: aggregated,
      errors: errors.map(e => ({
        type: e.cycle_type,
        message: e.error_message,
        time: e.created_at
      })),
      health: this.calculateHealth(aggregated, errors.length)
    };
  }

  private calculateHealth(metrics: any, errorCount: number): string {
    // Simple health calculation
    const totalRuns = metrics.extraction.runs + metrics.scoring.runs + metrics.cleanup.runs;
    
    if (totalRuns === 0) return 'unknown';
    
    const errorRate = errorCount / totalRuns;
    
    if (errorRate > 0.3) return 'poor';
    if (errorRate > 0.1) return 'fair';
    if (errorRate > 0) return 'good';
    
    return 'excellent';
  }
}