/**
 * Audit Log repository for Waddle
 */

import { BaseRepository } from './base-repository';

export interface AuditLogEntry {
  id: number;
  action: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  details?: any;
  createdAt: Date;
}

export interface CreateAuditLogDto {
  action: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  details?: any;
}

export class AuditLogRepository extends BaseRepository {
  create(dto: CreateAuditLogDto): AuditLogEntry {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (action, entity_type, entity_id, actor, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const detailsJson = dto.details ? JSON.stringify(dto.details) : null;
    
    const result = stmt.run(
      dto.action,
      dto.entityType || null,
      dto.entityId || null,
      dto.actor || null,
      detailsJson,
      now.getTime()
    );

    return {
      id: result.lastInsertRowid as number,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      actor: dto.actor,
      details: dto.details,
      createdAt: now,
    };
  }

  findByEntity(entityType: string, entityId: string, limit = 100): AuditLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(entityType, entityId, limit) as any[];
    return rows.map(row => this.mapRowToAuditLog(row));
  }

  findRecent(limit = 100): AuditLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log 
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapRowToAuditLog(row));
  }

  private mapRowToAuditLog(row: any): AuditLogEntry {
    return {
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actor: row.actor,
      details: row.details ? JSON.parse(row.details) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}