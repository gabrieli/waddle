/**
 * Context repository for Waddle
 */

import { BaseRepository } from './base-repository';
import type { Context } from '../../types';

export interface CreateContextDto {
  featureId: string;
  type: 'architecture' | 'review' | 'implementation';
  content: string;
  author?: string;
}

export interface ContextFilter {
  featureId?: string;
  type?: 'architecture' | 'review' | 'implementation';
  limit?: number;
  offset?: number;
}

export class ContextRepository extends BaseRepository {
  create(dto: CreateContextDto): Context {
    const stmt = this.db.prepare(`
      INSERT INTO context (feature_id, type, content, author, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const result = stmt.run(
      dto.featureId,
      dto.type,
      dto.content,
      dto.author,
      this.toTimestamp(now)
    );

    const context: Context = {
      id: result.lastInsertRowid as number,
      featureId: dto.featureId,
      type: dto.type,
      content: dto.content,
      author: dto.author,
      createdAt: now
    };

    return context;
  }

  findById(id: number): Context | null {
    const stmt = this.db.prepare('SELECT * FROM context WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToContext(row) : null;
  }

  findAll(filter?: ContextFilter): Context[] {
    let query = 'SELECT * FROM context WHERE 1=1';
    const params: any[] = [];

    if (filter?.featureId) {
      query += ' AND feature_id = ?';
      params.push(filter.featureId);
    }

    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
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
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapRowToContext(row));
  }

  findByFeature(featureId: string): Context[] {
    return this.findAll({ featureId });
  }

  findByFeatureAndType(featureId: string, type: 'architecture' | 'review' | 'implementation'): Context[] {
    return this.findAll({ featureId, type });
  }

  delete(id: number): void {
    const stmt = this.db.prepare('DELETE FROM context WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new Error(`Context not found: ${id}`);
    }
  }

  private mapRowToContext(row: any): Context {
    return {
      id: row.id,
      featureId: row.feature_id,
      type: row.type as 'architecture' | 'review' | 'implementation',
      content: row.content,
      author: row.author,
      createdAt: this.fromTimestamp(row.created_at)!
    };
  }
}