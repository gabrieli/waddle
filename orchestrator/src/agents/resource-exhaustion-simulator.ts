import { OrchestratorConfig } from '../orchestrator/config.js';
import { getLogger } from '../utils/logger.js';
const logger = getLogger();
import * as os from 'os';

export interface ResourceExhaustionConfig {
  memoryPressure?: {
    enabled: boolean;
    targetUsagePercent: number;
    checkIntervalMs: number;
  };
  rateLimiting?: {
    enabled: boolean;
    requestsPerMinute: number;
    burstSize: number;
  };
  responseDelays?: {
    enabled: boolean;
    minDelayMs: number;
    maxDelayMs: number;
  };
  errorInjection?: {
    enabled: boolean;
    errorRate: number; // 0-1
    errorTypes: ('timeout' | 'parse' | 'api')[];
  };
}

export class ResourceExhaustionSimulator {
  private config: ResourceExhaustionConfig;
  private memoryLeaks: Buffer[] = [];
  private requestTimestamps: number[] = [];
  private memoryCheckInterval?: NodeJS.Timeout;
  
  constructor(config: ResourceExhaustionConfig) {
    this.config = config;
    
    if (config.memoryPressure?.enabled) {
      this.startMemoryPressureSimulation();
    }
  }
  
  private startMemoryPressureSimulation() {
    const { targetUsagePercent, checkIntervalMs } = this.config.memoryPressure!;
    
    this.memoryCheckInterval = setInterval(() => {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
      
      logger.debug('Memory pressure check', {
        totalMemory: Math.round(totalMemory / 1024 / 1024) + 'MB',
        freeMemory: Math.round(freeMemory / 1024 / 1024) + 'MB',
        usedPercent: usedPercent.toFixed(2) + '%',
        targetPercent: targetUsagePercent + '%'
      });
      
      if (usedPercent < targetUsagePercent) {
        // Allocate more memory to increase pressure
        const allocationSize = Math.min(
          100 * 1024 * 1024, // 100MB chunks
          (totalMemory * (targetUsagePercent - usedPercent) / 100)
        );
        
        try {
          const leak = Buffer.alloc(allocationSize);
          // Fill with random data to prevent optimization
          for (let i = 0; i < leak.length; i += 1024) {
            leak[i] = Math.random() * 256;
          }
          this.memoryLeaks.push(leak);
          
          logger.info('Increased memory pressure', {
            allocationSize: Math.round(allocationSize / 1024 / 1024) + 'MB',
            totalLeaks: this.memoryLeaks.length
          });
        } catch (error) {
          logger.warn('Failed to allocate memory for pressure simulation', { error: error as Error });
        }
      } else if (usedPercent > targetUsagePercent + 5 && this.memoryLeaks.length > 0) {
        // Release some memory if we're over target
        this.memoryLeaks.pop();
        
        logger.info('Released memory pressure', {
          remainingLeaks: this.memoryLeaks.length
        });
      }
    }, checkIntervalMs);
  }
  
  async simulateRateLimit(): Promise<boolean> {
    if (!this.config.rateLimiting?.enabled) {
      return false;
    }
    
    const { requestsPerMinute, burstSize } = this.config.rateLimiting;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    
    // Check if we're over the rate limit
    if (this.requestTimestamps.length >= requestsPerMinute) {
      logger.warn('Rate limit exceeded', {
        currentRequests: this.requestTimestamps.length,
        limit: requestsPerMinute
      });
      return true;
    }
    
    // Check burst limit (requests in last 5 seconds)
    const fiveSecondsAgo = now - 5000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > fiveSecondsAgo).length;
    
    if (recentRequests >= burstSize) {
      logger.warn('Burst limit exceeded', {
        recentRequests,
        burstLimit: burstSize
      });
      return true;
    }
    
    // Record this request
    this.requestTimestamps.push(now);
    return false;
  }
  
  async simulateResponseDelay(): Promise<number> {
    if (!this.config.responseDelays?.enabled) {
      return 0;
    }
    
    const { minDelayMs, maxDelayMs } = this.config.responseDelays;
    const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs) + minDelayMs);
    
    logger.debug('Simulating response delay', { delayMs: delay });
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return delay;
  }
  
  shouldInjectError(): { inject: boolean; type?: string } {
    if (!this.config.errorInjection?.enabled) {
      return { inject: false };
    }
    
    const { errorRate, errorTypes } = this.config.errorInjection;
    
    if (Math.random() < errorRate) {
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      
      logger.warn('Injecting error', { errorType, errorRate });
      return { inject: true, type: errorType };
    }
    
    return { inject: false };
  }
  
  getResourceReport() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const cpuUsage = os.loadavg();
    
    return {
      memory: {
        total: Math.round(totalMemory / 1024 / 1024) + 'MB',
        used: Math.round(usedMemory / 1024 / 1024) + 'MB',
        free: Math.round(freeMemory / 1024 / 1024) + 'MB',
        usedPercent: ((usedMemory / totalMemory) * 100).toFixed(2) + '%',
        simulatedLeaks: this.memoryLeaks.length,
        simulatedLeakSize: Math.round(
          this.memoryLeaks.reduce((sum, leak) => sum + leak.length, 0) / 1024 / 1024
        ) + 'MB'
      },
      cpu: {
        loadAverage1m: cpuUsage[0].toFixed(2),
        loadAverage5m: cpuUsage[1].toFixed(2),
        loadAverage15m: cpuUsage[2].toFixed(2)
      },
      rateLimiting: {
        currentRequests: this.requestTimestamps.length,
        requestsInLastMinute: this.requestTimestamps.filter(
          ts => ts > Date.now() - 60000
        ).length
      }
    };
  }
  
  cleanup() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    // Release all memory leaks
    this.memoryLeaks = [];
    
    logger.info('Resource exhaustion simulator cleaned up');
  }
}