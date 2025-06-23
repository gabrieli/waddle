import { Database } from '../database/connection';
import { Pattern, PatternType, WorkItemResult, Review, ADR } from '../types/knowledge';
import { Logger } from '../utils/logger';
import { generateEmbedding } from './embeddings';
import { calculateSimilarity } from '../utils/similarity';

interface ExtractedPattern {
  context: string;
  solution: string;
  type: PatternType;
  agentRole: string;
  confidence: number;
  sourceWorkItemIds: string[];
  tags: string[];
}

interface PatternCandidate {
  pattern: ExtractedPattern;
  frequency: number;
  avgEffectiveness: number;
}

export class PatternExtractionService {
  private db: Database;
  private logger: Logger;
  private readonly MIN_PATTERN_FREQUENCY = 2;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;
  private readonly SIMILARITY_THRESHOLD = 0.85;

  constructor(db: Database) {
    this.db = db;
    this.logger = new Logger('PatternExtractionService');
  }

  async extractPatternsFromCompletedWork(
    startDate?: Date,
    endDate?: Date
  ): Promise<ExtractedPattern[]> {
    this.logger.info('Starting pattern extraction from completed work items');

    try {
      // Get completed work items with their results and reviews
      const workItems = await this.getCompletedWorkItems(startDate, endDate);
      
      // Extract candidate patterns from successful implementations
      const candidates = await this.extractCandidatePatterns(workItems);
      
      // Group similar patterns and calculate effectiveness
      const consolidatedPatterns = await this.consolidatePatterns(candidates);
      
      // Filter patterns based on frequency and effectiveness
      const qualifiedPatterns = this.filterQualifiedPatterns(consolidatedPatterns);
      
      this.logger.info(`Extracted ${qualifiedPatterns.length} qualified patterns`);
      return qualifiedPatterns.map(c => c.pattern);
    } catch (error) {
      this.logger.error('Failed to extract patterns', error);
      throw error;
    }
  }

  private async getCompletedWorkItems(
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    let query = `
      SELECT 
        wi.id,
        wi.type,
        wi.title,
        wi.description,
        wi.status,
        wi.completed_at,
        wir.agent_role,
        wir.implementation_notes,
        wir.files_changed,
        wir.tests_added,
        wir.success,
        wir.error_message,
        r.type as review_type,
        r.feedback,
        r.suggestions,
        r.quality_score
      FROM work_items wi
      LEFT JOIN work_item_results wir ON wi.id = wir.work_item_id
      LEFT JOIN reviews r ON wi.id = r.work_item_id
      WHERE wi.status = 'completed'
    `;

    const params: any[] = [];
    if (startDate) {
      query += ' AND wi.completed_at >= ?';
      params.push(startDate.toISOString());
    }
    if (endDate) {
      query += ' AND wi.completed_at <= ?';
      params.push(endDate.toISOString());
    }

    query += ' ORDER BY wi.completed_at DESC';

    return this.db.all(query, params);
  }

  private async extractCandidatePatterns(
    workItems: any[]
  ): Promise<PatternCandidate[]> {
    const patternMap = new Map<string, PatternCandidate>();

    for (const item of workItems) {
      if (!item.success || !item.implementation_notes) continue;

      const patterns = await this.extractPatternsFromWorkItem(item);
      
      for (const pattern of patterns) {
        const key = this.generatePatternKey(pattern);
        
        if (patternMap.has(key)) {
          const existing = patternMap.get(key)!;
          existing.frequency++;
          existing.pattern.sourceWorkItemIds.push(item.id);
          existing.avgEffectiveness = this.calculateEffectiveness(item, existing.avgEffectiveness);
        } else {
          patternMap.set(key, {
            pattern,
            frequency: 1,
            avgEffectiveness: this.calculateEffectiveness(item)
          });
        }
      }
    }

    return Array.from(patternMap.values());
  }

  private async extractPatternsFromWorkItem(
    workItem: any
  ): Promise<ExtractedPattern[]> {
    const patterns: ExtractedPattern[] = [];

    // Extract solution patterns
    if (workItem.implementation_notes) {
      const solutionPattern = await this.extractSolutionPattern(workItem);
      if (solutionPattern) patterns.push(solutionPattern);
    }

    // Extract error handling patterns
    if (workItem.error_message && workItem.success) {
      const errorPattern = await this.extractErrorHandlingPattern(workItem);
      if (errorPattern) patterns.push(errorPattern);
    }

    // Extract tool usage patterns
    const toolPattern = await this.extractToolUsagePattern(workItem);
    if (toolPattern) patterns.push(toolPattern);

    // Extract optimization patterns from reviews
    if (workItem.quality_score > 0.8) {
      const optimizationPattern = await this.extractOptimizationPattern(workItem);
      if (optimizationPattern) patterns.push(optimizationPattern);
    }

    return patterns;
  }

  private async extractSolutionPattern(
    workItem: any
  ): Promise<ExtractedPattern | null> {
    const context = this.extractContext(workItem);
    const solution = this.extractSolution(workItem);
    
    if (!context || !solution) return null;

    return {
      context,
      solution,
      type: 'solution',
      agentRole: workItem.agent_role,
      confidence: this.calculatePatternConfidence(workItem),
      sourceWorkItemIds: [workItem.id],
      tags: this.extractTags(workItem)
    };
  }

  private async extractErrorHandlingPattern(
    workItem: any
  ): Promise<ExtractedPattern | null> {
    const context = `Error: ${workItem.error_message}`;
    const solution = workItem.implementation_notes;
    
    return {
      context,
      solution,
      type: 'error_handling',
      agentRole: workItem.agent_role,
      confidence: this.calculatePatternConfidence(workItem),
      sourceWorkItemIds: [workItem.id],
      tags: ['error-recovery', ...this.extractTags(workItem)]
    };
  }

  private async extractToolUsagePattern(
    workItem: any
  ): Promise<ExtractedPattern | null> {
    // Extract tool usage from files changed and implementation notes
    const filesChanged = JSON.parse(workItem.files_changed || '[]');
    if (filesChanged.length === 0) return null;

    const context = `Working with ${filesChanged.length} files: ${filesChanged.join(', ')}`;
    const solution = this.extractToolUsageFromNotes(workItem.implementation_notes);
    
    if (!solution) return null;

    return {
      context,
      solution,
      type: 'tool_usage',
      agentRole: workItem.agent_role,
      confidence: this.calculatePatternConfidence(workItem),
      sourceWorkItemIds: [workItem.id],
      tags: ['tools', ...this.extractTags(workItem)]
    };
  }

  private async extractOptimizationPattern(
    workItem: any
  ): Promise<ExtractedPattern | null> {
    if (!workItem.suggestions) return null;

    const context = workItem.title;
    const solution = `${workItem.implementation_notes}\nOptimizations: ${workItem.suggestions}`;
    
    return {
      context,
      solution,
      type: 'optimization',
      agentRole: workItem.agent_role,
      confidence: workItem.quality_score,
      sourceWorkItemIds: [workItem.id],
      tags: ['performance', 'quality', ...this.extractTags(workItem)]
    };
  }

  private async consolidatePatterns(
    candidates: PatternCandidate[]
  ): Promise<PatternCandidate[]> {
    const consolidated: PatternCandidate[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < candidates.length; i++) {
      if (processed.has(i)) continue;

      const group: PatternCandidate[] = [candidates[i]];
      const embedding1 = await generateEmbedding(
        `${candidates[i].pattern.context} ${candidates[i].pattern.solution}`
      );

      for (let j = i + 1; j < candidates.length; j++) {
        if (processed.has(j)) continue;

        const embedding2 = await generateEmbedding(
          `${candidates[j].pattern.context} ${candidates[j].pattern.solution}`
        );

        const similarity = calculateSimilarity(embedding1, embedding2);
        
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          group.push(candidates[j]);
          processed.add(j);
        }
      }

      // Merge similar patterns
      const merged = this.mergePatternGroup(group);
      consolidated.push(merged);
    }

    return consolidated;
  }

  private mergePatternGroup(group: PatternCandidate[]): PatternCandidate {
    if (group.length === 1) return group[0];

    // Combine the best aspects of similar patterns
    const merged = group[0];
    
    for (let i = 1; i < group.length; i++) {
      merged.frequency += group[i].frequency;
      merged.pattern.sourceWorkItemIds.push(...group[i].pattern.sourceWorkItemIds);
      merged.pattern.tags = [...new Set([...merged.pattern.tags, ...group[i].pattern.tags])];
      merged.avgEffectiveness = (merged.avgEffectiveness + group[i].avgEffectiveness) / 2;
      
      // Use the pattern with higher confidence
      if (group[i].pattern.confidence > merged.pattern.confidence) {
        merged.pattern.context = group[i].pattern.context;
        merged.pattern.solution = group[i].pattern.solution;
        merged.pattern.confidence = group[i].pattern.confidence;
      }
    }

    return merged;
  }

  private filterQualifiedPatterns(
    patterns: PatternCandidate[]
  ): PatternCandidate[] {
    return patterns.filter(p => 
      p.frequency >= this.MIN_PATTERN_FREQUENCY &&
      p.pattern.confidence >= this.MIN_CONFIDENCE_THRESHOLD &&
      p.avgEffectiveness >= 0.6
    );
  }

  private extractContext(workItem: any): string {
    return `${workItem.type}: ${workItem.title}\n${workItem.description || ''}`.trim();
  }

  private extractSolution(workItem: any): string {
    return workItem.implementation_notes || '';
  }

  private extractTags(workItem: any): string[] {
    const tags: string[] = [workItem.type];
    
    // Extract tags from title and description
    const text = `${workItem.title} ${workItem.description || ''}`.toLowerCase();
    
    // Common technology keywords
    const techKeywords = ['api', 'database', 'ui', 'frontend', 'backend', 'auth', 
                         'security', 'performance', 'test', 'integration'];
    
    for (const keyword of techKeywords) {
      if (text.includes(keyword)) {
        tags.push(keyword);
      }
    }

    return [...new Set(tags)];
  }

  private extractToolUsageFromNotes(notes: string): string | null {
    if (!notes) return null;
    
    // Look for tool usage patterns in implementation notes
    const toolPatterns = [
      /used? (\w+) tool/gi,
      /implemented using (\w+)/gi,
      /(\w+) was helpful for/gi
    ];

    const tools: string[] = [];
    for (const pattern of toolPatterns) {
      const matches = notes.matchAll(pattern);
      for (const match of matches) {
        tools.push(match[1]);
      }
    }

    if (tools.length === 0) return null;
    
    return `Tools used: ${tools.join(', ')}\n${notes}`;
  }

  private calculatePatternConfidence(workItem: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on review scores
    if (workItem.quality_score) {
      confidence += workItem.quality_score * 0.3;
    }

    // Increase confidence if tests were added
    if (workItem.tests_added) {
      confidence += 0.1;
    }

    // Decrease confidence if there were errors initially
    if (workItem.error_message) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private calculateEffectiveness(
    workItem: any,
    currentAvg?: number
  ): number {
    let effectiveness = 0.5; // Base effectiveness

    // Factor in review quality score
    if (workItem.quality_score) {
      effectiveness = workItem.quality_score;
    }

    // Factor in success
    if (workItem.success) {
      effectiveness += 0.2;
    }

    // Factor in whether tests were added
    if (workItem.tests_added) {
      effectiveness += 0.1;
    }

    effectiveness = Math.min(effectiveness, 1);

    // If updating average, blend with current
    if (currentAvg !== undefined) {
      return (currentAvg + effectiveness) / 2;
    }

    return effectiveness;
  }

  private generatePatternKey(pattern: ExtractedPattern): string {
    return `${pattern.type}:${pattern.agentRole}:${pattern.context.substring(0, 50)}`;
  }

  async saveExtractedPatterns(patterns: ExtractedPattern[]): Promise<void> {
    for (const pattern of patterns) {
      try {
        const embedding = await generateEmbedding(
          `${pattern.context} ${pattern.solution}`
        );

        await this.db.run(
          `INSERT INTO patterns (
            context, solution, pattern_type, agent_role,
            effectiveness_score, usage_count, embedding, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            pattern.context,
            pattern.solution,
            pattern.type,
            pattern.agentRole,
            pattern.confidence,
            0,
            JSON.stringify(embedding)
          ]
        );

        // Link pattern to source work items
        const patternId = await this.db.get(
          'SELECT last_insert_rowid() as id'
        ).then(r => r.id);

        for (const workItemId of pattern.sourceWorkItemIds) {
          await this.db.run(
            `INSERT INTO pattern_work_items (pattern_id, work_item_id) 
             VALUES (?, ?)`,
            [patternId, workItemId]
          );
        }

        this.logger.info(`Saved new pattern: ${pattern.type} for ${pattern.agentRole}`);
      } catch (error) {
        this.logger.error(`Failed to save pattern: ${error}`);
      }
    }
  }
}