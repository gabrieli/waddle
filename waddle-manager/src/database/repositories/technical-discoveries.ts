import { BaseRepository } from './base-repository';

export interface TechnicalDiscovery {
  id: number;
  featureId: string;
  discoveryType: 'pattern' | 'dependency' | 'risk' | 'constraint' | 'integration_point' | 'performance_consideration';
  title: string;
  description: string;
  impact?: 'low' | 'medium' | 'high' | 'critical';
  resolutionStrategy?: string;
  discoveredAt: number;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

export interface CreateTechnicalDiscoveryDto {
  featureId: string;
  discoveryType: TechnicalDiscovery['discoveryType'];
  title: string;
  description: string;
  impact?: TechnicalDiscovery['impact'];
  resolutionStrategy?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTechnicalDiscoveryDto {
  resolutionStrategy?: string;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

export class TechnicalDiscoveryRepository extends BaseRepository {

  create(dto: CreateTechnicalDiscoveryDto): TechnicalDiscovery {
    const stmt = this.db.prepare(`
      INSERT INTO technical_discoveries (
        feature_id, discovery_type, title, description, 
        impact, resolution_strategy, discovered_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      dto.featureId,
      dto.discoveryType,
      dto.title,
      dto.description,
      dto.impact || null,
      dto.resolutionStrategy || null,
      Date.now(),
      dto.metadata ? JSON.stringify(dto.metadata) : null
    );

    const insertedId = result.lastInsertRowid as number;
    return this.findById(insertedId)!;
  }

  update(id: number, dto: UpdateTechnicalDiscoveryDto): TechnicalDiscovery | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (dto.resolutionStrategy !== undefined) {
      updates.push('resolution_strategy = ?');
      values.push(dto.resolutionStrategy);
    }

    if (dto.resolvedAt !== undefined) {
      updates.push('resolved_at = ?');
      values.push(dto.resolvedAt);
    }

    if (dto.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(dto.metadata));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE technical_discoveries 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  findByFeatureId(featureId: string): TechnicalDiscovery[] {
    const stmt = this.db.prepare(`
      SELECT * FROM technical_discoveries 
      WHERE feature_id = ?
      ORDER BY discovered_at DESC
    `);
    
    const rows = stmt.all(featureId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findByType(discoveryType: TechnicalDiscovery['discoveryType']): TechnicalDiscovery[] {
    const stmt = this.db.prepare(`
      SELECT * FROM technical_discoveries 
      WHERE discovery_type = ?
      ORDER BY discovered_at DESC
    `);
    
    const rows = stmt.all(discoveryType) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findUnresolved(): TechnicalDiscovery[] {
    const stmt = this.db.prepare(`
      SELECT * FROM technical_discoveries 
      WHERE resolved_at IS NULL
      ORDER BY impact DESC, discovered_at ASC
    `);
    
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRow(row));
  }

  findById(id: number): TechnicalDiscovery | null {
    const stmt = this.db.prepare(`
      SELECT * FROM technical_discoveries WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: any): TechnicalDiscovery {
    return {
      id: row.id,
      featureId: row.feature_id,
      discoveryType: row.discovery_type,
      title: row.title,
      description: row.description,
      impact: row.impact,
      resolutionStrategy: row.resolution_strategy,
      discoveredAt: row.discovered_at,
      resolvedAt: row.resolved_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
}