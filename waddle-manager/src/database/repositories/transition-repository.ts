/**
 * Transition repository for Waddle
 */

import { BaseRepository } from './base-repository';
import type { Transition, Actor } from '../../types';

export interface CreateTransitionDto {
  entityType: 'feature' | 'task';
  entityId: string;
  fromState?: string;
  toState: string;
  reason?: string;
  actor: Actor;
  metadata?: Record<string, any>;
}

export interface TransitionFilter {
  entityType?: 'feature' | 'task';
  entityId?: string;
  actor?: Actor;
  limit?: number;
  offset?: number;
}

export class TransitionRepository extends BaseRepository {
  create(dto: CreateTransitionDto): Transition {
    const stmt = this.db.prepare(`
      INSERT INTO transitions (entity_type, entity_id, from_state, to_state, reason, actor, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const result = stmt.run(
      dto.entityType,
      dto.entityId,
      dto.fromState,
      dto.toState,
      dto.reason,
      dto.actor,
      this.toTimestamp(now),
      this.toJSON(dto.metadata)
    );

    const transition: Transition = {
      id: result.lastInsertRowid as number,
      entityType: dto.entityType,
      entityId: dto.entityId,
      fromState: dto.fromState,
      toState: dto.toState,
      reason: dto.reason,
      actor: dto.actor,
      createdAt: now,
      metadata: dto.metadata
    };

    return transition;
  }

  findById(id: number): Transition | null {
    const stmt = this.db.prepare('SELECT * FROM transitions WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToTransition(row) : null;
  }

  findAll(filter?: TransitionFilter): Transition[] {
    let query = 'SELECT * FROM transitions WHERE 1=1';
    const params: any[] = [];

    if (filter?.entityType) {
      query += ' AND entity_type = ?';
      params.push(filter.entityType);
    }

    if (filter?.entityId) {
      query += ' AND entity_id = ?';
      params.push(filter.entityId);
    }

    if (filter?.actor) {
      query += ' AND actor = ?';
      params.push(filter.actor);
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
    return rows.map(row => this.mapRowToTransition(row));
  }

  findByEntity(entityType: 'feature' | 'task', entityId: string): Transition[] {
    return this.findAll({ entityType, entityId });
  }

  findLatestByEntity(entityType: 'feature' | 'task', entityId: string): Transition | null {
    const transitions = this.findAll({ entityType, entityId, limit: 1 });
    return transitions[0] || null;
  }

  private mapRowToTransition(row: any): Transition {
    return {
      id: row.id,
      entityType: row.entity_type as 'feature' | 'task',
      entityId: row.entity_id,
      fromState: row.from_state,
      toState: row.to_state,
      reason: row.reason,
      actor: row.actor as Actor,
      createdAt: this.fromTimestamp(row.created_at)!,
      metadata: this.fromJSON(row.metadata) || undefined
    };
  }
}