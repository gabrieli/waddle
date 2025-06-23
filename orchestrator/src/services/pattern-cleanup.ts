import { Database } from '../database/connection';
import { Pattern } from '../types/knowledge';
import { Logger } from '../utils/logger';
import { calculateSimilarity } from '../utils/similarity';

interface CleanupConfig {
  effectivenessThreshold: number;
  maxPatternAge: number; // in days
  minUsageForRetention: number;
  duplicateSimilarityThreshold: number;
}

export class PatternCleanupService {
  private db: Database;
  private logger: Logger;
  private config: CleanupConfig;

  constructor(db: Database, config?: Partial<CleanupConfig>) {
    this.db = db;
    this.logger = new Logger('PatternCleanupService');
    this.config = {
      effectivenessThreshold: 0.3,
      maxPatternAge: 180, // 6 months
      minUsageForRetention: 2,
      duplicateSimilarityThreshold: 0.95,
      ...config
    };
  }

  async cleanupIneffectivePatterns(): Promise<number> {
    this.logger.info('Starting cleanup of ineffective patterns');

    try {
      // Find patterns with low effectiveness and low usage
      const ineffectivePatterns = await this.db.all(
        `SELECT id, context, effectiveness_score, usage_count 
         FROM patterns 
         WHERE effectiveness_score < ? 
         AND usage_count < ?
         AND created_at < datetime('now', '-30 days')`,
        [this.config.effectivenessThreshold, this.config.minUsageForRetention]
      );

      let removed = 0;
      
      for (const pattern of ineffectivePatterns) {
        // Check if pattern has any recent successful applications
        const recentSuccess = await this.hasRecentSuccess(pattern.id);
        
        if (!recentSuccess) {
          await this.removePattern(pattern.id);
          removed++;
          
          this.logger.info(`Removed ineffective pattern ${pattern.id}`, {
            effectiveness: pattern.effectiveness_score,
            usage: pattern.usage_count
          });
        }
      }

      this.logger.info(`Cleanup completed. Removed ${removed} ineffective patterns`);
      return removed;
    } catch (error) {
      this.logger.error('Failed to cleanup ineffective patterns', error);
      throw error;
    }
  }

  async archiveOldPatterns(): Promise<number> {
    this.logger.info('Starting archival of old patterns');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.maxPatternAge);

      // Create archive table if it doesn't exist
      await this.ensureArchiveTable();

      // Find old patterns with low usage
      const oldPatterns = await this.db.all(
        `SELECT * FROM patterns 
         WHERE created_at < ? 
         AND usage_count < ?
         AND effectiveness_score < 0.5`,
        [cutoffDate.toISOString(), this.config.minUsageForRetention * 2]
      );

      let archived = 0;

      for (const pattern of oldPatterns) {
        await this.archivePattern(pattern);
        archived++;
      }

      this.logger.info(`Archival completed. Archived ${archived} old patterns`);
      return archived;
    } catch (error) {
      this.logger.error('Failed to archive old patterns', error);
      throw error;
    }
  }

  async mergeDuplicatePatterns(): Promise<number> {
    this.logger.info('Starting merge of duplicate patterns');

    try {
      const patterns = await this.db.all(
        `SELECT id, context, solution, embedding, effectiveness_score, usage_count 
         FROM patterns 
         WHERE embedding IS NOT NULL`
      );

      const duplicateGroups = await this.findDuplicateGroups(patterns);
      let merged = 0;

      for (const group of duplicateGroups) {
        await this.mergePatternGroup(group);
        merged += group.length - 1; // Keep one, merge others
      }

      this.logger.info(`Merge completed. Merged ${merged} duplicate patterns`);
      return merged;
    } catch (error) {
      this.logger.error('Failed to merge duplicate patterns', error);
      throw error;
    }
  }

  private async hasRecentSuccess(patternId: string): Promise<boolean> {
    const result = await this.db.get(
      `SELECT COUNT(*) as count
       FROM pattern_work_items pwi
       JOIN work_item_results wir ON pwi.work_item_id = wir.work_item_id
       JOIN work_items wi ON pwi.work_item_id = wi.id
       WHERE pwi.pattern_id = ?
       AND wir.success = 1
       AND wi.completed_at > datetime('now', '-30 days')`,
      [patternId]
    );

    return result.count > 0;
  }

  private async removePattern(patternId: string): Promise<void> {
    // Remove pattern associations first
    await this.db.run(
      'DELETE FROM pattern_work_items WHERE pattern_id = ?',
      [patternId]
    );

    // Remove the pattern
    await this.db.run(
      'DELETE FROM patterns WHERE id = ?',
      [patternId]
    );
  }

  private async ensureArchiveTable(): Promise<void> {
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS archived_patterns (
        id TEXT PRIMARY KEY,
        context TEXT NOT NULL,
        solution TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        effectiveness_score REAL NOT NULL,
        usage_count INTEGER DEFAULT 0,
        embedding TEXT,
        created_at DATETIME NOT NULL,
        archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archive_reason TEXT
      )
    `);
  }

  private async archivePattern(pattern: any): Promise<void> {
    // Insert into archive
    await this.db.run(
      `INSERT INTO archived_patterns 
       (id, context, solution, pattern_type, agent_role, effectiveness_score, 
        usage_count, embedding, created_at, archive_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pattern.id,
        pattern.context,
        pattern.solution,
        pattern.pattern_type,
        pattern.agent_role,
        pattern.effectiveness_score,
        pattern.usage_count,
        pattern.embedding,
        pattern.created_at,
        'Age and low usage'
      ]
    );

    // Remove from active patterns
    await this.removePattern(pattern.id);
  }

  private async findDuplicateGroups(patterns: any[]): Promise<any[][]> {
    const groups: any[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < patterns.length; i++) {
      if (processed.has(patterns[i].id)) continue;

      const group = [patterns[i]];
      const embedding1 = JSON.parse(patterns[i].embedding);

      for (let j = i + 1; j < patterns.length; j++) {
        if (processed.has(patterns[j].id)) continue;

        const embedding2 = JSON.parse(patterns[j].embedding);
        const similarity = calculateSimilarity(embedding1, embedding2);

        if (similarity >= this.config.duplicateSimilarityThreshold) {
          group.push(patterns[j]);
          processed.add(patterns[j].id);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  private async mergePatternGroup(group: any[]): Promise<void> {
    // Sort by effectiveness and usage to keep the best pattern
    group.sort((a, b) => {
      const scoreA = a.effectiveness_score * 0.7 + (a.usage_count / 100) * 0.3;
      const scoreB = b.effectiveness_score * 0.7 + (b.usage_count / 100) * 0.3;
      return scoreB - scoreA;
    });

    const keepPattern = group[0];
    const mergePatterns = group.slice(1);

    // Update the kept pattern with combined usage
    const totalUsage = group.reduce((sum, p) => sum + p.usage_count, 0);
    
    await this.db.run(
      `UPDATE patterns 
       SET usage_count = ?, 
           updated_at = datetime('now'),
           context = CASE 
             WHEN LENGTH(context) < LENGTH(?) THEN ? 
             ELSE context 
           END,
           solution = CASE 
             WHEN LENGTH(solution) < LENGTH(?) THEN ? 
             ELSE solution 
           END
       WHERE id = ?`,
      [
        totalUsage,
        this.getBestContext(group),
        this.getBestContext(group),
        this.getBestSolution(group),
        this.getBestSolution(group),
        keepPattern.id
      ]
    );

    // Transfer work item associations
    for (const pattern of mergePatterns) {
      await this.db.run(
        `UPDATE pattern_work_items 
         SET pattern_id = ? 
         WHERE pattern_id = ?`,
        [keepPattern.id, pattern.id]
      );

      // Remove the duplicate pattern
      await this.removePattern(pattern.id);
    }

    this.logger.info(`Merged ${mergePatterns.length} patterns into ${keepPattern.id}`);
  }

  private getBestContext(group: any[]): string {
    // Return the most detailed context
    return group.reduce((best, pattern) => {
      return pattern.context.length > best.length ? pattern.context : best;
    }, group[0].context);
  }

  private getBestSolution(group: any[]): string {
    // Return the most detailed solution
    return group.reduce((best, pattern) => {
      return pattern.solution.length > best.length ? pattern.solution : best;
    }, group[0].solution);
  }

  async getCleanupStatistics(): Promise<any> {
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_patterns,
        COUNT(CASE WHEN effectiveness_score < ? THEN 1 END) as low_effectiveness,
        COUNT(CASE WHEN usage_count < ? THEN 1 END) as low_usage,
        COUNT(CASE WHEN created_at < datetime('now', '-${this.config.maxPatternAge} days') THEN 1 END) as old_patterns,
        AVG(effectiveness_score) as avg_effectiveness,
        AVG(usage_count) as avg_usage
      FROM patterns`,
      [this.config.effectivenessThreshold, this.config.minUsageForRetention]
    );

    const archivedStats = await this.db.get(
      'SELECT COUNT(*) as archived_count FROM archived_patterns'
    ).catch(() => ({ archived_count: 0 }));

    return {
      ...stats,
      archived_patterns: archivedStats.archived_count,
      cleanup_config: this.config
    };
  }

  async restoreArchivedPattern(patternId: string): Promise<void> {
    const archived = await this.db.get(
      'SELECT * FROM archived_patterns WHERE id = ?',
      [patternId]
    );

    if (!archived) {
      throw new Error(`Archived pattern ${patternId} not found`);
    }

    // Restore to active patterns
    await this.db.run(
      `INSERT INTO patterns 
       (id, context, solution, pattern_type, agent_role, effectiveness_score, 
        usage_count, embedding, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        archived.id,
        archived.context,
        archived.solution,
        archived.pattern_type,
        archived.agent_role,
        archived.effectiveness_score,
        archived.usage_count,
        archived.embedding,
        archived.created_at
      ]
    );

    // Remove from archive
    await this.db.run(
      'DELETE FROM archived_patterns WHERE id = ?',
      [patternId]
    );

    this.logger.info(`Restored pattern ${patternId} from archive`);
  }
}