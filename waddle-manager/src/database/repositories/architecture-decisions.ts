import { BaseRepository } from './base-repository';

export interface ArchitectureDecision {
  id: number;
  featureId: string;
  decisionType: 'technology' | 'pattern' | 'structure' | 'integration';
  title: string;
  context: string;
  decision: string;
  consequences?: string;
  alternativesConsidered?: Record<string, any>;
  createdAt: number;
  author: string;
}

export interface CreateArchitectureDecisionDto {
  featureId: string;
  decisionType: ArchitectureDecision['decisionType'];
  title: string;
  context: string;
  decision: string;
  consequences?: string;
  alternativesConsidered?: Record<string, any>;
  author: string;
}

export class ArchitectureDecisionRepository extends BaseRepository {

  create(dto: CreateArchitectureDecisionDto): ArchitectureDecision {
    const stmt = this.db.prepare(`
      INSERT INTO architecture_decisions (
        feature_id, decision_type, title, context, decision,
        consequences, alternatives_considered, created_at, author
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      dto.featureId,
      dto.decisionType,
      dto.title,
      dto.context,
      dto.decision,
      dto.consequences || null,
      dto.alternativesConsidered ? JSON.stringify(dto.alternativesConsidered) : null,
      Date.now(),
      dto.author
    );

    const insertedId = result.lastInsertRowid as number;
    return this.findById(insertedId)!;
  }

  findByFeatureId(featureId: string): ArchitectureDecision[] {
    const stmt = this.db.prepare(`
      SELECT * FROM architecture_decisions 
      WHERE feature_id = ?
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(featureId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findByType(decisionType: ArchitectureDecision['decisionType']): ArchitectureDecision[] {
    const stmt = this.db.prepare(`
      SELECT * FROM architecture_decisions 
      WHERE decision_type = ?
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(decisionType) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findByAuthor(author: string): ArchitectureDecision[] {
    const stmt = this.db.prepare(`
      SELECT * FROM architecture_decisions 
      WHERE author = ?
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(author) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findSimilarDecisions(decisionType: ArchitectureDecision['decisionType'], limit: number = 5): ArchitectureDecision[] {
    const stmt = this.db.prepare(`
      SELECT * FROM architecture_decisions 
      WHERE decision_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(decisionType, limit) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findById(id: number): ArchitectureDecision | null {
    const stmt = this.db.prepare(`
      SELECT * FROM architecture_decisions WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: any): ArchitectureDecision {
    return {
      id: row.id,
      featureId: row.feature_id,
      decisionType: row.decision_type,
      title: row.title,
      context: row.context,
      decision: row.decision,
      consequences: row.consequences,
      alternativesConsidered: row.alternatives_considered ? JSON.parse(row.alternatives_considered) : undefined,
      createdAt: row.created_at,
      author: row.author
    };
  }
}