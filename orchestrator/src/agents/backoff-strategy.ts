import { getLogger } from '../utils/logger.js';
const logger = getLogger();

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxRetries: number;
  jitterMs: number;
}

export class BackoffStrategy {
  private config: BackoffConfig;
  private attempts: Map<string, number> = new Map();
  private lastAttemptTime: Map<string, number> = new Map();
  
  constructor(config: Partial<BackoffConfig> = {}) {
    this.config = {
      initialDelayMs: config.initialDelayMs || 1000,
      maxDelayMs: config.maxDelayMs || 60000,
      multiplier: config.multiplier || 2,
      maxRetries: config.maxRetries || 5,
      jitterMs: config.jitterMs || 100
    };
  }
  
  async executeWithBackoff<T>(
    key: string,
    operation: () => Promise<T>,
    shouldRetry: (error: any) => boolean = () => true
  ): Promise<T> {
    const attempts = this.attempts.get(key) || 0;
    
    try {
      const result = await operation();
      
      // Success - reset attempts
      this.attempts.delete(key);
      this.lastAttemptTime.delete(key);
      
      return result;
    } catch (error) {
      // Check if we should retry
      if (!shouldRetry(error) || attempts >= this.config.maxRetries) {
        logger.error('Backoff strategy: max retries exceeded or non-retryable error', {
          key,
          attempts,
          maxRetries: this.config.maxRetries,
          error: error as Error
        });
        
        // Reset attempts for next time
        this.attempts.delete(key);
        this.lastAttemptTime.delete(key);
        
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        this.config.initialDelayMs * Math.pow(this.config.multiplier, attempts),
        this.config.maxDelayMs
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * this.config.jitterMs * 2 - this.config.jitterMs;
      const delay = Math.max(0, baseDelay + jitter);
      
      logger.warn('Backoff strategy: retrying after delay', {
        key,
        attempt: attempts + 1,
        delayMs: Math.round(delay),
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      // Update attempts
      this.attempts.set(key, attempts + 1);
      this.lastAttemptTime.set(key, Date.now());
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Recursive retry
      return this.executeWithBackoff(key, operation, shouldRetry);
    }
  }
  
  getBackoffStatus(key: string) {
    const attempts = this.attempts.get(key) || 0;
    const lastAttempt = this.lastAttemptTime.get(key);
    
    return {
      attempts,
      lastAttemptTime: lastAttempt ? new Date(lastAttempt).toISOString() : null,
      isBackingOff: attempts > 0,
      nextDelay: attempts > 0 ? this.calculateNextDelay(attempts) : 0
    };
  }
  
  private calculateNextDelay(attempts: number): number {
    return Math.min(
      this.config.initialDelayMs * Math.pow(this.config.multiplier, attempts),
      this.config.maxDelayMs
    );
  }
  
  resetBackoff(key: string) {
    this.attempts.delete(key);
    this.lastAttemptTime.delete(key);
    
    logger.debug('Backoff reset', { key });
  }
  
  getAllBackoffStatuses() {
    const statuses: Record<string, any> = {};
    
    for (const [key] of this.attempts) {
      statuses[key] = this.getBackoffStatus(key);
    }
    
    return statuses;
  }
}