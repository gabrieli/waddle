/**
 * Feature repository for Waddle
 */

import { BaseRepository } from './base-repository';
import type { Feature, FeatureStatus, Priority } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureRow } from './types';

export interface CreateFeatureDto {
  description: string;
  priority?: Priority;
  metadata?: Record<string, unknown>;
}

export interface UpdateFeatureDto {
  description?: string;
  status?: FeatureStatus;
  priority?: Priority;
  metadata?: Record<string, unknown>;
}

export interface FeatureFilter {
  status?: FeatureStatus | FeatureStatus[];
  priority?: Priority | Priority[];
  limit?: number;
  offset?: number;
}

export class FeatureRepository extends BaseRepository {
  create(dto: CreateFeatureDto): Feature {
    const id = uuidv4();
    const now = new Date();
    
    const feature: Feature = {
      id,
      description: dto.description,
      status: 'pending',
      priority: dto.priority || 'normal',
      createdAt: now,
      updatedAt: now,
      metadata: dto.metadata
    };

    const stmt = this.db.prepare(`
      INSERT INTO features (id, description, status, priority, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      feature.id,
      feature.description,
      feature.status,
      feature.priority,
      this.toTimestamp(feature.createdAt),
      this.toTimestamp(feature.updatedAt),
      this.toJSON(feature.metadata)
    );

    return feature;
  }

  findById(id: string): Feature | null {
    const stmt = this.db.prepare(`
      SELECT * FROM features WHERE id = ?
    `);

    const row = stmt.get(id) as FeatureRow | undefined;
    return row ? this.mapRowToFeature(row) : null;
  }

  findAll(filter?: FeatureFilter): Feature[] {
    let query = 'SELECT * FROM features WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    if (filter?.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      query += ` AND priority IN (${priorities.map(() => '?').join(',')})`;
      params.push(...priorities);
    }

    query += ' ORDER BY created_at DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    if (filter?.offset) {
      query += ' OFFSET ?';
      params.push(filter.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as FeatureRow[];
    return rows.map(row => this.mapRowToFeature(row));
  }

  update(id: string, updates: UpdateFeatureDto): Feature {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error(`Feature not found: ${id}`);
    }

    const updatedFeature: Feature = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    if (updates.status === 'complete' && !existing.completedAt) {
      updatedFeature.completedAt = new Date();
    }

    const stmt = this.db.prepare(`
      UPDATE features 
      SET description = ?, status = ?, priority = ?, updated_at = ?, completed_at = ?, metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedFeature.description,
      updatedFeature.status,
      updatedFeature.priority,
      this.toTimestamp(updatedFeature.updatedAt),
      this.toTimestamp(updatedFeature.completedAt),
      this.toJSON(updatedFeature.metadata),
      id
    );

    return updatedFeature;
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM features WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new Error(`Feature not found: ${id}`);
    }
  }

  private mapRowToFeature(row: FeatureRow): Feature {
    return {
      id: row.id,
      description: row.description,
      status: row.status as FeatureStatus,
      priority: row.priority as Priority,
      createdAt: this.fromTimestamp(row.created_at)!,
      updatedAt: this.fromTimestamp(row.updated_at)!,
      completedAt: this.fromTimestamp(row.completed_at),
      metadata: this.fromJSON(row.metadata) || undefined
    };
  }
}