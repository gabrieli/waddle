/**
 * Task repository for Waddle
 */

import { BaseRepository } from './base-repository';
import type { Task, TaskStatus, Role } from '../../types';

export interface CreateTaskDto {
  featureId: string;
  role: Role;
  description: string;
}

export interface UpdateTaskDto {
  status?: TaskStatus;
  attempts?: number;
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
  error?: string;
}

export interface TaskFilter {
  featureId?: string;
  role?: Role;
  status?: TaskStatus | TaskStatus[];
  limit?: number;
  offset?: number;
}

export class TaskRepository extends BaseRepository {
  create(dto: CreateTaskDto): Task {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (feature_id, role, description, status, attempts, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const result = stmt.run(
      dto.featureId,
      dto.role,
      dto.description,
      'pending',
      0,
      this.toTimestamp(now)
    );

    const task: Task = {
      id: result.lastInsertRowid as number,
      featureId: dto.featureId,
      role: dto.role,
      description: dto.description,
      status: 'pending',
      attempts: 0,
      createdAt: now
    };

    return task;
  }

  findById(id: number): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToTask(row) : null;
  }

  findAll(filter?: TaskFilter): Task[] {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filter?.featureId) {
      query += ' AND feature_id = ?';
      params.push(filter.featureId);
    }

    if (filter?.role) {
      query += ' AND role = ?';
      params.push(filter.role);
    }

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    query += ' ORDER BY created_at ASC';

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
    return rows.map(row => this.mapRowToTask(row));
  }

  update(id: number, updates: UpdateTaskDto): Task {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error(`Task not found: ${id}`);
    }

    const updatedTask: Task = {
      ...existing,
      ...updates
    };

    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = ?, attempts = ?, started_at = ?, completed_at = ?, output = ?, error = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedTask.status,
      updatedTask.attempts,
      this.toTimestamp(updatedTask.startedAt),
      this.toTimestamp(updatedTask.completedAt),
      this.toJSON(updatedTask.output),
      updatedTask.error,
      id
    );

    return updatedTask;
  }

  delete(id: number): void {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new Error(`Task not found: ${id}`);
    }
  }

  findByFeatureId(featureId: string): Task[] {
    return this.findAll({ featureId });
  }

  findPendingTasks(limit?: number): Task[] {
    return this.findAll({ status: 'pending', limit });
  }

  incrementAttempts(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE tasks SET attempts = attempts + 1 WHERE id = ?
    `);
    stmt.run(id);
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      featureId: row.feature_id,
      role: row.role as Role,
      description: row.description,
      status: row.status as TaskStatus,
      attempts: row.attempts,
      createdAt: this.fromTimestamp(row.created_at)!,
      startedAt: this.fromTimestamp(row.started_at),
      completedAt: this.fromTimestamp(row.completed_at),
      output: this.fromJSON(row.output),
      error: row.error
    };
  }
}