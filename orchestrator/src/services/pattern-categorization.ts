import { Database } from '../database/connection';
import { Pattern, PatternType } from '../types/knowledge';
import { Logger } from '../utils/logger';
import { generateEmbedding } from './embeddings';
import { calculateSimilarity } from '../utils/similarity';

interface CategorySignature {
  type: PatternType;
  keywords: string[];
  contextPatterns: RegExp[];
  solutionPatterns: RegExp[];
  confidence: number;
}

interface CategoryMatch {
  type: PatternType;
  confidence: number;
  matchedKeywords: string[];
  matchedPatterns: string[];
}

export class PatternCategorizationService {
  private db: Database;
  private logger: Logger;
  private categorySignatures: CategorySignature[];

  constructor(db: Database) {
    this.db = db;
    this.logger = new Logger('PatternCategorizationService');
    this.categorySignatures = this.initializeCategorySignatures();
  }

  private initializeCategorySignatures(): CategorySignature[] {
    return [
      {
        type: 'solution',
        keywords: ['implement', 'create', 'build', 'develop', 'add', 'feature', 'functionality'],
        contextPatterns: [
          /implement\s+\w+\s+feature/i,
          /add\s+new\s+functionality/i,
          /create\s+\w+\s+component/i,
          /build\s+\w+\s+system/i
        ],
        solutionPatterns: [
          /created?\s+\w+\s+class/i,
          /implemented?\s+\w+\s+method/i,
          /added?\s+new\s+\w+/i
        ],
        confidence: 0.8
      },
      {
        type: 'approach',
        keywords: ['strategy', 'approach', 'method', 'technique', 'pattern', 'design'],
        contextPatterns: [
          /design\s+\w+\s+system/i,
          /architect\s+\w+\s+solution/i,
          /choose\s+\w+\s+approach/i,
          /decide\s+between/i
        ],
        solutionPatterns: [
          /used?\s+\w+\s+pattern/i,
          /applied?\s+\w+\s+approach/i,
          /followed?\s+\w+\s+strategy/i
        ],
        confidence: 0.75
      },
      {
        type: 'tool_usage',
        keywords: ['tool', 'library', 'framework', 'package', 'api', 'sdk', 'cli'],
        contextPatterns: [
          /use\s+\w+\s+tool/i,
          /integrate\s+with\s+\w+/i,
          /work\s+with\s+\w+\s+api/i,
          /configure\s+\w+/i
        ],
        solutionPatterns: [
          /installed?\s+\w+/i,
          /configured?\s+\w+/i,
          /integrated?\s+\w+/i,
          /used?\s+\w+\s+command/i
        ],
        confidence: 0.85
      },
      {
        type: 'error_handling',
        keywords: ['error', 'exception', 'bug', 'fix', 'issue', 'problem', 'crash', 'failure'],
        contextPatterns: [
          /error:\s*.+/i,
          /exception\s+thrown/i,
          /bug\s+in\s+\w+/i,
          /fails?\s+to\s+\w+/i,
          /crashes?\s+when/i
        ],
        solutionPatterns: [
          /fixed?\s+by\s+\w+/i,
          /handled?\s+\w+\s+error/i,
          /caught\s+exception/i,
          /resolved?\s+by\s+\w+/i
        ],
        confidence: 0.9
      },
      {
        type: 'optimization',
        keywords: ['optimize', 'performance', 'speed', 'efficiency', 'refactor', 'improve'],
        contextPatterns: [
          /slow\s+\w+\s+performance/i,
          /optimize\s+\w+/i,
          /improve\s+\w+\s+efficiency/i,
          /reduce\s+\w+\s+time/i
        ],
        solutionPatterns: [
          /optimized?\s+by\s+\w+/i,
          /improved?\s+performance/i,
          /reduced?\s+\w+\s+by/i,
          /cached?\s+\w+/i
        ],
        confidence: 0.8
      }
    ];
  }

  async categorizePattern(pattern: Partial<Pattern>): Promise<PatternType> {
    const matches = this.findCategoryMatches(pattern);
    
    if (matches.length === 0) {
      // Use ML-based categorization as fallback
      return await this.mlCategorize(pattern);
    }

    // Sort by confidence and return highest
    matches.sort((a, b) => b.confidence - a.confidence);
    
    this.logger.info(
      `Categorized pattern as ${matches[0].type} with confidence ${matches[0].confidence}`
    );
    
    return matches[0].type;
  }

  private findCategoryMatches(pattern: Partial<Pattern>): CategoryMatch[] {
    const matches: CategoryMatch[] = [];
    const text = `${pattern.context || ''} ${pattern.solution || ''}`.toLowerCase();

    for (const signature of this.categorySignatures) {
      const match = this.matchSignature(text, pattern, signature);
      
      if (match.confidence > 0.5) {
        matches.push(match);
      }
    }

    return matches;
  }

  private matchSignature(
    text: string,
    pattern: Partial<Pattern>,
    signature: CategorySignature
  ): CategoryMatch {
    let confidence = 0;
    const matchedKeywords: string[] = [];
    const matchedPatterns: string[] = [];

    // Check keywords
    for (const keyword of signature.keywords) {
      if (text.includes(keyword)) {
        confidence += 0.1;
        matchedKeywords.push(keyword);
      }
    }

    // Check context patterns
    if (pattern.context) {
      for (const regexPattern of signature.contextPatterns) {
        const match = pattern.context.match(regexPattern);
        if (match) {
          confidence += 0.2;
          matchedPatterns.push(match[0]);
        }
      }
    }

    // Check solution patterns
    if (pattern.solution) {
      for (const regexPattern of signature.solutionPatterns) {
        const match = pattern.solution.match(regexPattern);
        if (match) {
          confidence += 0.2;
          matchedPatterns.push(match[0]);
        }
      }
    }

    // Apply signature confidence modifier
    confidence *= signature.confidence;

    return {
      type: signature.type,
      confidence: Math.min(confidence, 1),
      matchedKeywords,
      matchedPatterns
    };
  }

  private async mlCategorize(pattern: Partial<Pattern>): Promise<PatternType> {
    // Use embeddings to find similar categorized patterns
    const text = `${pattern.context || ''} ${pattern.solution || ''}`;
    const embedding = await generateEmbedding(text);

    const similarPatterns = await this.findSimilarCategorizedPatterns(embedding);
    
    if (similarPatterns.length === 0) {
      // Default to 'solution' if no matches
      return 'solution';
    }

    // Vote based on similar patterns
    const votes: Record<PatternType, number> = {
      solution: 0,
      approach: 0,
      tool_usage: 0,
      error_handling: 0,
      optimization: 0
    };

    for (const similar of similarPatterns) {
      votes[similar.pattern_type as PatternType] += similar.similarity;
    }

    // Return type with highest vote
    let maxVotes = 0;
    let bestType: PatternType = 'solution';

    for (const [type, voteCount] of Object.entries(votes)) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        bestType = type as PatternType;
      }
    }

    return bestType;
  }

  private async findSimilarCategorizedPatterns(
    embedding: number[]
  ): Promise<any[]> {
    const patterns = await this.db.all(
      `SELECT id, pattern_type, embedding 
       FROM patterns 
       WHERE embedding IS NOT NULL 
       LIMIT 100`
    );

    const similarities = patterns.map(p => {
      const patternEmbedding = JSON.parse(p.embedding);
      const similarity = calculateSimilarity(embedding, patternEmbedding);
      return { ...p, similarity };
    });

    // Return top 5 most similar
    return similarities
      .filter(s => s.similarity > 0.7)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  async recategorizePatterns(): Promise<void> {
    this.logger.info('Starting pattern recategorization');

    const patterns = await this.db.all(
      'SELECT id, context, solution, pattern_type FROM patterns'
    );

    let updated = 0;
    
    for (const pattern of patterns) {
      const newCategory = await this.categorizePattern(pattern);
      
      if (newCategory !== pattern.pattern_type) {
        await this.db.run(
          'UPDATE patterns SET pattern_type = ? WHERE id = ?',
          [newCategory, pattern.id]
        );
        updated++;
        
        this.logger.info(
          `Recategorized pattern ${pattern.id} from ${pattern.pattern_type} to ${newCategory}`
        );
      }
    }

    this.logger.info(`Recategorization complete. Updated ${updated} patterns`);
  }

  async analyzeCategorizationAccuracy(): Promise<any> {
    // Compare automatic categorization with manual corrections
    const query = `
      SELECT 
        p.id,
        p.pattern_type as current_type,
        p.context,
        p.solution,
        COUNT(pwi.work_item_id) as usage_count,
        AVG(r.quality_score) as avg_quality
      FROM patterns p
      LEFT JOIN pattern_work_items pwi ON p.id = pwi.pattern_id
      LEFT JOIN reviews r ON pwi.work_item_id = r.work_item_id
      GROUP BY p.id
    `;

    const patterns = await this.db.all(query);
    const results: any = {
      totalPatterns: patterns.length,
      byCategory: {},
      recategorizationSuggestions: []
    };

    for (const pattern of patterns) {
      const suggestedCategory = await this.categorizePattern(pattern);
      
      if (!results.byCategory[pattern.current_type]) {
        results.byCategory[pattern.current_type] = {
          count: 0,
          avgQuality: 0,
          totalUsage: 0
        };
      }

      results.byCategory[pattern.current_type].count++;
      results.byCategory[pattern.current_type].avgQuality += pattern.avg_quality || 0;
      results.byCategory[pattern.current_type].totalUsage += pattern.usage_count;

      if (suggestedCategory !== pattern.current_type) {
        results.recategorizationSuggestions.push({
          patternId: pattern.id,
          currentType: pattern.current_type,
          suggestedType: suggestedCategory,
          context: pattern.context.substring(0, 100)
        });
      }
    }

    // Calculate averages
    for (const category in results.byCategory) {
      const cat = results.byCategory[category];
      cat.avgQuality = cat.count > 0 ? cat.avgQuality / cat.count : 0;
    }

    return results;
  }

  async extractCategoryTags(pattern: Partial<Pattern>): Promise<string[]> {
    const tags: Set<string> = new Set();
    const text = `${pattern.context || ''} ${pattern.solution || ''}`.toLowerCase();

    // Technology tags
    const techPatterns = [
      { pattern: /react|component|jsx/i, tag: 'react' },
      { pattern: /node|express|fastify/i, tag: 'nodejs' },
      { pattern: /python|django|flask/i, tag: 'python' },
      { pattern: /docker|container|kubernetes/i, tag: 'containerization' },
      { pattern: /aws|azure|gcp|cloud/i, tag: 'cloud' },
      { pattern: /postgres|mysql|mongodb|database/i, tag: 'database' },
      { pattern: /redis|cache|memcached/i, tag: 'caching' },
      { pattern: /test|spec|jest|mocha/i, tag: 'testing' },
      { pattern: /ci\/cd|jenkins|github actions/i, tag: 'cicd' },
      { pattern: /security|auth|oauth|jwt/i, tag: 'security' }
    ];

    // Domain tags
    const domainPatterns = [
      { pattern: /api|rest|graphql|endpoint/i, tag: 'api' },
      { pattern: /ui|frontend|interface|ux/i, tag: 'frontend' },
      { pattern: /backend|server|service/i, tag: 'backend' },
      { pattern: /mobile|ios|android|react native/i, tag: 'mobile' },
      { pattern: /ml|machine learning|ai|model/i, tag: 'ml' },
      { pattern: /data|etl|pipeline|analytics/i, tag: 'data' },
      { pattern: /microservice|distributed|messaging/i, tag: 'microservices' }
    ];

    // Check all patterns
    for (const { pattern, tag } of [...techPatterns, ...domainPatterns]) {
      if (pattern.test(text)) {
        tags.add(tag);
      }
    }

    // Add pattern type as tag
    if (pattern.pattern_type) {
      tags.add(pattern.pattern_type);
    }

    return Array.from(tags);
  }
}