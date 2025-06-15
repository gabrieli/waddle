/**
 * Main orchestrator module
 */

import { EventEmitter } from 'events';
import { EnhancedOrchestrator } from './enhanced-orchestrator';
import type { Database } from 'better-sqlite3';
import type { OrchestratorConfig } from './enhanced-orchestrator';

export class WaddleManager extends EventEmitter {
  private orchestrator?: EnhancedOrchestrator;

  constructor() {
    super();
  }

  async initialize(db: Database, config?: OrchestratorConfig): Promise<void> {
    this.orchestrator = new EnhancedOrchestrator(db, config);
    
    // Forward orchestrator events
    this.orchestrator.on('started', () => {
      console.log('🐧 Waddle starting...');
      this.emit('manager:started');
    });
    
    this.orchestrator.on('stopped', () => {
      console.log('🐧 Waddle stopped');
      this.emit('manager:stopped');
    });
    
    this.orchestrator.on('paused', () => {
      console.log('⏸️  Waddle paused');
      this.emit('manager:paused');
    });
    
    this.orchestrator.on('resumed', () => {
      console.log('▶️  Waddle resumed');
      this.emit('manager:resumed');
    });
    
    this.orchestrator.on('development:started', () => {
      console.log('🚀 Development mode started');
      this.emit('development:started');
    });
    
    this.orchestrator.on('development:stopped', () => {
      console.log('🛑 Development mode stopped');
      this.emit('development:stopped');
    });
    
    this.orchestrator.on('task:started', (data) => this.emit('task:started', data));
    this.orchestrator.on('task:completed', (data) => this.emit('task:completed', data));
    this.orchestrator.on('task:failed', (data) => this.emit('task:failed', data));
    this.orchestrator.on('feature:completed', (data) => this.emit('feature:completed', data));
    this.orchestrator.on('self-healing:created', (data) => {
      console.log(`🔧 Self-healing task created: ${data.type}`);
      this.emit('self-healing:created', data);
    });
    
    this.orchestrator.on('error', (error) => {
      console.error('❌ Orchestrator error:', error);
      this.emit('error', error);
    });
  }

  async start(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('WaddleManager not initialized. Call initialize() first.');
    }
    await this.orchestrator.start();
  }

  async stop(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('WaddleManager not initialized. Call initialize() first.');
    }
    await this.orchestrator.stop();
  }

  async pause(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('WaddleManager not initialized. Call initialize() first.');
    }
    await this.orchestrator.pause();
  }

  async resume(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('WaddleManager not initialized. Call initialize() first.');
    }
    await this.orchestrator.resume();
  }
  
  startDevelopment(): void {
    if (!this.orchestrator) {
      throw new Error('WaddleManager not initialized. Call initialize() first.');
    }
    this.orchestrator.startDevelopment();
  }
  
  stopDevelopment(): void {
    if (!this.orchestrator) {
      throw new Error('WaddleManager not initialized. Call initialize() first.');
    }
    this.orchestrator.stopDevelopment();
  }
  
  isDevelopmentMode(): boolean {
    return this.orchestrator ? this.orchestrator.isDevelopmentMode() : false;
  }

  isRunning(): boolean {
    return this.orchestrator ? true : false;
  }

  isPaused(): boolean {
    return false; // Will be implemented when orchestrator provides this
  }
  
  getMetrics(): any {
    if (!this.orchestrator) {
      throw new Error('WaddleManager not initialized. Call initialize() first.');
    }
    return this.orchestrator.getMetrics();
  }
  
  getRunningTasks(): any[] {
    if (!this.orchestrator) {
      return [];
    }
    return this.orchestrator.getRunningTasks();
  }
}

// Legacy alias for backward compatibility
export { WaddleManager as Waddle };
export { EnhancedOrchestrator };
export type { OrchestratorConfig };