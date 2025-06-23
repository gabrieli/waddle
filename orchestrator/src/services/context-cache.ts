import { ScoredKnowledge } from './context-retrieval.js';
import { getLogger } from '../utils/logger.js';
import crypto from 'crypto';

const logger = getLogger();

export interface CacheConfig {
  maxSize?: number;
  ttlMinutes?: number;
  enableStats?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

interface CacheEntry {
  value: ScoredKnowledge;
  timestamp: number;
  lastAccessed: number;
}

export class ContextCache {
  private cache: Map<string, CacheEntry>;
  private config: Required<CacheConfig>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 500,
      ttlMinutes: config.ttlMinutes || 15,
      enableStats: config.enableStats ?? true
    };
    
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };

    logger.info('Context cache initialized', {
      maxSize: this.config.maxSize,
      ttlMinutes: this.config.ttlMinutes
    });
  }

  /**
   * Generate a cache key from context parameters
   */
  generateKey(agentRole: string, workItemId: string, taskDescription: string): string {
    // Create a key that's both unique and somewhat readable
    const taskHash = crypto.createHash('sha256')
      .update(taskDescription)
      .digest('hex')
      .substring(0, 8);
    return `${agentRole}:${workItemId}:${taskHash}`;
  }

  /**
   * Get cached knowledge if available and not expired
   */
  get(key: string): ScoredKnowledge | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.config.enableStats) {
        this.stats.misses++;
      }
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    const maxAge = this.config.ttlMinutes * 60 * 1000;
    
    if (age > maxAge) {
      this.cache.delete(key);
      if (this.config.enableStats) {
        this.stats.misses++;
      }
      logger.debug('Cache entry expired', { key, ageMinutes: age / 60000 });
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    
    if (this.config.enableStats) {
      this.stats.hits++;
    }
    
    return entry.value;
  }

  /**
   * Store knowledge in cache
   */
  set(key: string, value: ScoredKnowledge): void {
    // Check if we need to evict (only if adding a new key)
    const isNewKey = !this.cache.has(key);
    const needsEviction = isNewKey && this.cache.size >= this.config.maxSize;
    
    if (needsEviction) {
      logger.debug('Cache full, evicting LRU', {
        currentSize: this.cache.size,
        maxSize: this.config.maxSize
      });
      this.evictLRU();
    }

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    
    logger.debug('Cache entry added', {
      key,
      patternsCount: value.patterns.length,
      adrsCount: value.adrs.length,
      reviewsCount: value.reviews.length,
      cacheSize: this.cache.size,
      wasEviction: needsEviction
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      if (this.config.enableStats) {
        this.stats.evictions++;
      }
      logger.debug('Cache entry evicted', { 
        key: oldestKey,
        cacheSize: this.cache.size,
        maxSize: this.config.maxSize
      });
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      hitRate
    };
  }

  /**
   * Pre-warm cache with common queries
   */
  warmup(entries: Array<{ key: string; value: ScoredKnowledge }>): void {
    logger.info('Warming up cache', { entriesCount: entries.length });
    
    for (const { key, value } of entries) {
      this.set(key, value);
    }
    
    logger.info('Cache warmup complete', { 
      size: this.cache.size,
      maxSize: this.config.maxSize 
    });
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const maxAge = this.config.ttlMinutes * 60 * 1000;
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info('Cache cleanup complete', { entriesRemoved: removed });
    }
  }
}