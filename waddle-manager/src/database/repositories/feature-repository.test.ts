/**
 * Feature repository tests for Waddle
 */

import { Database } from '../index';
import { FeatureRepository } from './feature-repository';
import * as fs from 'fs';

describe('FeatureRepository', () => {
  let db: Database;
  let repo: FeatureRepository;
  const testDbPath = './test-feature-repo.db';

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
    await db.initialize();
    repo = db.features;
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('create', () => {
    it('should create a feature with default values', () => {
      const feature = repo.create({ description: 'Test feature' });
      
      expect(feature.id).toBeDefined();
      expect(feature.description).toBe('Test feature');
      expect(feature.status).toBe('pending');
      expect(feature.priority).toBe('normal');
      expect(feature.createdAt).toBeInstanceOf(Date);
      expect(feature.updatedAt).toBeInstanceOf(Date);
      expect(feature.completedAt).toBeUndefined();
    });

    it('should create a feature with custom priority', () => {
      const feature = repo.create({ 
        description: 'High priority feature',
        priority: 'high' 
      });
      
      expect(feature.priority).toBe('high');
    });

    it('should create a feature with metadata', () => {
      const metadata = { tags: ['frontend', 'urgent'], estimation: 5 };
      const feature = repo.create({ 
        description: 'Feature with metadata',
        metadata 
      });
      
      expect(feature.metadata).toEqual(metadata);
    });
  });

  describe('findById', () => {
    it('should find an existing feature', () => {
      const created = repo.create({ description: 'Find me' });
      const found = repo.findById(created.id);
      
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.description).toBe('Find me');
    });

    it('should return null for non-existent feature', () => {
      const found = repo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      // Create test features
      repo.create({ description: 'Feature 1', priority: 'low' });
      repo.create({ description: 'Feature 2', priority: 'high' });
      repo.create({ description: 'Feature 3', priority: 'high' });
      repo.create({ description: 'Feature 4', priority: 'critical' });
    });

    it('should find all features', () => {
      const features = repo.findAll();
      expect(features).toHaveLength(4);
    });

    it('should filter by status', () => {
      const feature = repo.create({ description: 'In progress' });
      repo.update(feature.id, { status: 'in_progress' });
      
      const pending = repo.findAll({ status: 'pending' });
      const inProgress = repo.findAll({ status: 'in_progress' });
      
      expect(pending).toHaveLength(4);
      expect(inProgress).toHaveLength(1);
    });

    it('should filter by priority', () => {
      const high = repo.findAll({ priority: 'high' });
      const critical = repo.findAll({ priority: 'critical' });
      
      expect(high).toHaveLength(2);
      expect(critical).toHaveLength(1);
    });

    it('should filter by multiple priorities', () => {
      const features = repo.findAll({ priority: ['high', 'critical'] });
      expect(features).toHaveLength(3);
    });

    it('should respect limit and offset', () => {
      const page1 = repo.findAll({ limit: 2, offset: 0 });
      const page2 = repo.findAll({ limit: 2, offset: 2 });
      
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('update', () => {
    it('should update feature fields', async () => {
      const feature = repo.create({ description: 'Original' });
      
      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = repo.update(feature.id, {
        description: 'Updated',
        priority: 'high'
      });
      
      expect(updated.description).toBe('Updated');
      expect(updated.priority).toBe('high');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(feature.updatedAt.getTime());
    });

    it('should set completedAt when status becomes complete', () => {
      const feature = repo.create({ description: 'To complete' });
      expect(feature.completedAt).toBeUndefined();
      
      const updated = repo.update(feature.id, { status: 'complete' });
      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it('should throw for non-existent feature', () => {
      expect(() => {
        repo.update('non-existent', { status: 'complete' });
      }).toThrow('Feature not found');
    });
  });

  describe('delete', () => {
    it('should delete an existing feature', () => {
      const feature = repo.create({ description: 'Delete me' });
      repo.delete(feature.id);
      
      const found = repo.findById(feature.id);
      expect(found).toBeNull();
    });

    it('should throw for non-existent feature', () => {
      expect(() => {
        repo.delete('non-existent');
      }).toThrow('Feature not found');
    });

    it('should cascade delete related tasks', () => {
      const feature = repo.create({ description: 'Feature with tasks' });
      
      db.tasks.create({
        featureId: feature.id,
        role: 'architect',
        description: 'Task 1'
      });
      
      repo.delete(feature.id);
      
      const tasks = db.tasks.findByFeatureId(feature.id);
      expect(tasks).toHaveLength(0);
    });
  });
});