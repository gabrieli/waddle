/**
 * Base repository with common database operations
 */

import type Database from 'better-sqlite3';

export abstract class BaseRepository {
  constructor(protected db: Database.Database) {}

  protected toJSON(value: any): string | null {
    return value ? JSON.stringify(value) : null;
  }

  protected fromJSON<T>(value: string | null): T | null {
    return value ? JSON.parse(value) : null;
  }

  protected toTimestamp(date: Date | undefined): number | null {
    return date ? date.getTime() : null;
  }

  protected fromTimestamp(value: number | null): Date | undefined {
    return value ? new Date(value) : undefined;
  }

  protected runInTransaction<R>(fn: () => R): R {
    return this.db.transaction(fn)();
  }
}