import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextCache } from './context-cache.js';
import { ScoredKnowledge } from './context-retrieval.js';

describe('ContextCache', () => {
  let cache: ContextCache;

  beforeEach(() => {
    cache = new ContextCache({
      maxSize: 100,
      ttlMinutes: 15
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('basic caching', () => {
    it('should store and retrieve cached knowledge', () => {
      const knowledge: ScoredKnowledge = {
        patterns: [{
          id: 'P1',
          type: 'pattern',
          content: 'Test pattern',
          relevanceScore: 0.8,
          metadata: {}
        }],
        adrs: [],
        reviews: []
      };

      const key = cache.generateKey('developer', 'STORY-001', 'Implement feature');
      
      cache.set(key, knowledge);
      const retrieved = cache.get(key);
      
      expect(retrieved).toEqual(knowledge);
    });

    it('should return null for non-existent keys', () => {
      const key = 'non-existent-key';
      const result = cache.get(key);
      
      expect(result).toBeNull();
    });

    it('should respect TTL expiration', () => {
      const knowledge: ScoredKnowledge = {
        patterns: [],
        adrs: [],
        reviews: []
      };

      // Create cache with 1 minute TTL
      const shortCache = new ContextCache({ ttlMinutes: 1/60 }); // 1 second
      const key = 'test-key';
      
      shortCache.set(key, knowledge);
      expect(shortCache.get(key)).toEqual(knowledge);
      
      // Wait for expiration
      vi.useFakeTimers();
      vi.advanceTimersByTime(2000); // 2 seconds
      
      expect(shortCache.get(key)).toBeNull();
      
      vi.useRealTimers();
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = cache.generateKey('developer', 'STORY-001', 'Implement auth');
      const key2 = cache.generateKey('developer', 'STORY-001', 'Implement auth');
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cache.generateKey('developer', 'STORY-001', 'Task A');
      const key2 = cache.generateKey('developer', 'STORY-002', 'Task A');
      const key3 = cache.generateKey('reviewer', 'STORY-001', 'Task A');
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it('should handle special characters in task descriptions', () => {
      const key = cache.generateKey('developer', 'STORY-001', 'Task with "quotes" & special chars!');
      
      expect(key).toBeTruthy();
      expect(key).toContain('developer');
      expect(key).toContain('STORY-001');
    });
  });

  describe('cache size management', () => {
    it('should respect max size limit', async () => {
      const smallCache = new ContextCache({ maxSize: 3 });
      const knowledge: ScoredKnowledge = {
        patterns: [],
        adrs: [],
        reviews: []
      };

      // Add 4 items with delays to ensure different timestamps
      smallCache.set('key1', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      smallCache.set('key2', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      smallCache.set('key3', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // When we add the 4th item, key1 should be evicted (oldest)
      smallCache.set('key4', knowledge);
      
      // First item should be evicted (LRU = oldest without recent access)
      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key2')).toBeTruthy();
      expect(smallCache.get('key3')).toBeTruthy();
      expect(smallCache.get('key4')).toBeTruthy();
      
      expect(smallCache.size()).toBe(3);
    });

    it('should use LRU eviction policy', async () => {
      const smallCache = new ContextCache({ maxSize: 3 });
      const knowledge: ScoredKnowledge = {
        patterns: [],
        adrs: [],
        reviews: []
      };

      // Add 3 items with small delays to ensure different timestamps
      smallCache.set('key1', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      smallCache.set('key2', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      smallCache.set('key3', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify cache is full
      expect(smallCache.size()).toBe(3);
      
      // Access key1 to make it recently used
      smallCache.get('key1');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Add a 4th item - should evict key2 since key1 was just accessed
      // and key2 is the oldest that hasn't been accessed
      smallCache.set('key4', knowledge);
      
      // Verify size is still 3
      expect(smallCache.size()).toBe(3);
      
      // key2 should be evicted (least recently used)
      expect(smallCache.get('key1')).toBeTruthy();
      expect(smallCache.get('key2')).toBeNull();
      expect(smallCache.get('key3')).toBeTruthy();
      expect(smallCache.get('key4')).toBeTruthy();
    });
  });

  describe('cache statistics', () => {
    it('should track hit and miss rates', () => {
      const knowledge: ScoredKnowledge = {
        patterns: [],
        adrs: [],
        reviews: []
      };

      cache.set('key1', knowledge);
      
      // 2 hits
      cache.get('key1');
      cache.get('key1');
      
      // 3 misses
      cache.get('key2');
      cache.get('key3');
      cache.get('key4');
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBeCloseTo(0.4, 2);
      expect(stats.size).toBe(1);
    });

    it('should track evictions', async () => {
      const smallCache = new ContextCache({ maxSize: 2, enableStats: true });
      const knowledge: ScoredKnowledge = {
        patterns: [],
        adrs: [],
        reviews: []
      };

      smallCache.set('key1', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      smallCache.set('key2', knowledge);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // This should evict key1
      smallCache.set('key3', knowledge);
      
      const stats = smallCache.getStats();
      
      expect(stats.evictions).toBe(1);
      expect(smallCache.size()).toBe(2);
    });
  });

  describe('cache warmup', () => {
    it('should support pre-warming cache with common queries', async () => {
      const knowledge: ScoredKnowledge = {
        patterns: [{
          id: 'P1',
          type: 'pattern',
          content: 'Common pattern',
          relevanceScore: 0.9,
          metadata: {}
        }],
        adrs: [],
        reviews: []
      };

      const warmupData = [
        { key: 'common-key-1', value: knowledge },
        { key: 'common-key-2', value: knowledge }
      ];

      cache.warmup(warmupData);
      
      expect(cache.get('common-key-1')).toEqual(knowledge);
      expect(cache.get('common-key-2')).toEqual(knowledge);
    });
  });
});