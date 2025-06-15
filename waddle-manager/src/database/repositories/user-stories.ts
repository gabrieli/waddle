import { BaseRepository } from './base-repository';
import { v4 as uuidv4 } from 'uuid';

export interface UserStory {
  id: string;
  epicId?: string;
  title: string;
  description: string;
  acceptanceCriteria: any[]; // Array of criteria objects
  storyPoints?: number;
  businessValue?: number;
  status: 'draft' | 'ready' | 'in_progress' | 'testing' | 'done' | 'blocked';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  metadata?: Record<string, any>;
}

export interface CreateUserStoryDto {
  id?: string;
  epicId?: string;
  title: string;
  description: string;
  acceptanceCriteria: any[];
  storyPoints?: number;
  businessValue?: number;
  status?: UserStory['status'];
  metadata?: Record<string, any>;
}

export interface UpdateUserStoryDto {
  title?: string;
  description?: string;
  acceptanceCriteria?: any[];
  storyPoints?: number;
  businessValue?: number;
  status?: UserStory['status'];
  metadata?: Record<string, any>;
}

export class UserStoryRepository extends BaseRepository {

  create(dto: CreateUserStoryDto): UserStory {
    const id = dto.id || uuidv4();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO user_stories (
        id, epic_id, title, description, acceptance_criteria,
        story_points, business_value, status, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      dto.epicId || null,
      dto.title,
      dto.description,
      JSON.stringify(dto.acceptanceCriteria),
      dto.storyPoints || null,
      dto.businessValue || null,
      dto.status || 'draft',
      now,
      now,
      dto.metadata ? JSON.stringify(dto.metadata) : null
    );

    return this.findById(id)!;
  }

  update(id: string, dto: UpdateUserStoryDto): UserStory | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (dto.title !== undefined) {
      updates.push('title = ?');
      values.push(dto.title);
    }

    if (dto.description !== undefined) {
      updates.push('description = ?');
      values.push(dto.description);
    }

    if (dto.acceptanceCriteria !== undefined) {
      updates.push('acceptance_criteria = ?');
      values.push(JSON.stringify(dto.acceptanceCriteria));
    }

    if (dto.storyPoints !== undefined) {
      updates.push('story_points = ?');
      values.push(dto.storyPoints);
    }

    if (dto.businessValue !== undefined) {
      updates.push('business_value = ?');
      values.push(dto.businessValue);
    }

    if (dto.status !== undefined) {
      updates.push('status = ?');
      values.push(dto.status);

      if (dto.status === 'done') {
        updates.push('completed_at = ?');
        values.push(Date.now());
      }
    }

    if (dto.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(dto.metadata));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE user_stories 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  findByEpicId(epicId: string): UserStory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM user_stories 
      WHERE epic_id = ?
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all(epicId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findByStatus(status: UserStory['status']): UserStory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM user_stories 
      WHERE status = ?
      ORDER BY updated_at DESC
    `);
    
    const rows = stmt.all(status) as any[];
    return rows.map(row => this.mapRow(row));
  }

  linkToTask(storyId: string, taskId: number): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO task_user_stories (task_id, user_story_id)
      VALUES (?, ?)
    `);
    
    stmt.run(taskId, storyId);
  }

  findStoriesByTaskId(taskId: number): UserStory[] {
    const stmt = this.db.prepare(`
      SELECT us.* FROM user_stories us
      JOIN task_user_stories tus ON us.id = tus.user_story_id
      WHERE tus.task_id = ?
      ORDER BY us.created_at ASC
    `);
    
    const rows = stmt.all(taskId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  findById(id: string): UserStory | null {
    const stmt = this.db.prepare(`
      SELECT * FROM user_stories WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: any): UserStory {
    return {
      id: row.id,
      epicId: row.epic_id,
      title: row.title,
      description: row.description,
      acceptanceCriteria: JSON.parse(row.acceptance_criteria),
      storyPoints: row.story_points,
      businessValue: row.business_value,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
}