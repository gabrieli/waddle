/**
 * Database tests for Waddle
 */

import { Database } from './index';
import * as fs from 'fs';

describe('Database', () => {
  let db: Database;
  const testDbPath = './test-waddle.db';

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
  });

  afterEach(async () => {
    await db.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialize', () => {
    it('should create database file', async () => {
      await db.initialize();
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should run migrations', async () => {
      await db.initialize();
      const conn = db.getConnection();
      
      // Check that tables exist
      const tables = conn.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];
      
      const tableNames = tables.map(t => t.name).sort();
      expect(tableNames).toContain('features');
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('transitions');
      expect(tableNames).toContain('context');
      expect(tableNames).toContain('audit_log');
      expect(tableNames).toContain('migrations');
    });

    it('should be idempotent', async () => {
      await db.initialize();
      await db.close();
      
      // Initialize again
      db = new Database(testDbPath);
      await db.initialize();
      
      // Should not throw and should still work
      const feature = db.features.create({ description: 'Test feature' });
      expect(feature.id).toBeDefined();
    });
  });

  describe('getConnection', () => {
    it('should throw if not initialized', () => {
      expect(() => db.getConnection()).toThrow('Database not initialized');
    });

    it('should return connection after initialization', async () => {
      await db.initialize();
      const conn = db.getConnection();
      expect(conn).toBeDefined();
    });
  });

  describe('transaction', () => {
    it('should rollback on error', async () => {
      await db.initialize();
      
      const feature = db.features.create({ description: 'Test feature' });
      
      try {
        db.transaction(() => {
          db.features.update(feature.id, { status: 'in_progress' });
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }
      
      // Feature should not be updated
      const retrieved = db.features.findById(feature.id);
      expect(retrieved?.status).toBe('pending');
    });

    it('should commit on success', async () => {
      await db.initialize();
      
      const feature = db.features.create({ description: 'Test feature' });
      
      db.transaction(() => {
        db.features.update(feature.id, { status: 'in_progress' });
      });
      
      const retrieved = db.features.findById(feature.id);
      expect(retrieved?.status).toBe('in_progress');
    });
  });

  describe('repository access', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('should provide features repository', () => {
      expect(db.features).toBeDefined();
      const feature = db.features.create({ description: 'Test' });
      expect(feature).toBeDefined();
    });

    it('should provide tasks repository', () => {
      expect(db.tasks).toBeDefined();
      const feature = db.features.create({ description: 'Test' });
      const task = db.tasks.create({
        featureId: feature.id,
        role: 'architect',
        description: 'Design system'
      });
      expect(task).toBeDefined();
    });

    it('should provide transitions repository', () => {
      expect(db.transitions).toBeDefined();
      const transition = db.transitions.create({
        entityType: 'feature',
        entityId: 'test-id',
        toState: 'in_progress',
        actor: 'system'
      });
      expect(transition).toBeDefined();
    });

    it('should provide context repository', () => {
      expect(db.context).toBeDefined();
      const feature = db.features.create({ description: 'Test' });
      const context = db.context.create({
        featureId: feature.id,
        type: 'architecture',
        content: 'System design document'
      });
      expect(context).toBeDefined();
    });
  });
});