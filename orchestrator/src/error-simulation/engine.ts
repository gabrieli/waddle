import { ErrorSimulationConfig, ErrorSimulationStats, ErrorType } from './types.js';
import { logger } from '../utils/logger.js';
import * as crypto from 'crypto';

export class ErrorSimulationEngine {
  private static instance: ErrorSimulationEngine;
  private config: ErrorSimulationConfig;
  private stats: ErrorSimulationStats;
  private randomGenerator: () => number;

  private constructor() {
    this.config = {
      enabled: false,
      targetAgents: [],
      injectionRate: 0,
      errorTypes: {
        jsonParsing: {
          enabled: false,
          subtypes: {
            syntaxError: false,
            typeError: false,
            missingFields: false,
            unexpectedStructure: false,
            truncatedJson: false,
            invalidCharacters: false
          }
        },
        apiCommunication: {
          enabled: false,
          subtypes: {
            timeout: false,
            connectionRefused: false,
            invalidResponse: false,
            partialResponse: false,
            maxBufferExceeded: false
          }
        },
        stateManagement: {
          enabled: false,
          subtypes: {
            databaseLocked: false,
            transactionFailed: false,
            invalidStateTransition: false,
            concurrencyConflict: false
          }
        }
      }
    };
    
    this.stats = {
      totalRequests: 0,
      errorsInjected: 0,
      errorsByType: {},
      errorsByAgent: {},
      startTime: new Date()
    };
    
    this.randomGenerator = this.createRandomGenerator();
  }

  static getInstance(): ErrorSimulationEngine {
    if (!ErrorSimulationEngine.instance) {
      ErrorSimulationEngine.instance = new ErrorSimulationEngine();
    }
    return ErrorSimulationEngine.instance;
  }

  private createRandomGenerator(seed?: number): () => number {
    if (seed !== undefined) {
      // Create a seeded random generator for reproducibility
      let state = seed;
      return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
      };
    }
    return Math.random;
  }

  configure(config: ErrorSimulationConfig): void {
    this.config = { ...config };
    this.randomGenerator = this.createRandomGenerator(config.seed);
    
    if (config.enabled) {
      logger.info('Error simulation configured', { 
        targetAgents: config.targetAgents,
        injectionRate: config.injectionRate 
      });
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): ErrorSimulationConfig {
    return { ...this.config };
  }

  getStats(): ErrorSimulationStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      errorsInjected: 0,
      errorsByType: {},
      errorsByAgent: {},
      startTime: new Date()
    };
  }

  shouldInjectError(agentType: string): boolean {
    if (!this.config.enabled) return false;
    if (!this.config.targetAgents.includes(agentType) && !this.config.targetAgents.includes('*')) {
      return false;
    }

    this.stats.totalRequests++;
    this.stats.errorsByAgent[agentType] = (this.stats.errorsByAgent[agentType] || 0) + 1;

    const shouldInject = this.randomGenerator() * 100 < this.config.injectionRate;
    
    if (shouldInject) {
      logger.warn('Error injection triggered', { agentType, injectionRate: this.config.injectionRate });
    }
    
    return shouldInject;
  }

  private recordError(errorType: ErrorType, agent: string, details: string): void {
    this.stats.errorsInjected++;
    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
    this.stats.lastError = {
      timestamp: new Date(),
      agent,
      errorType,
      details
    };
    
    logger.warn('Error injected', { errorType, agent, details });
  }

  // JSON Parsing Error Injection
  injectJsonParsingError(output: string, agentType: string): string {
    if (!this.shouldInjectError(agentType)) return output;
    if (!this.config.errorTypes.jsonParsing.enabled) return output;

    const enabledSubtypes = Object.entries(this.config.errorTypes.jsonParsing.subtypes)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type);

    if (enabledSubtypes.length === 0) return output;

    const selectedType = enabledSubtypes[Math.floor(this.randomGenerator() * enabledSubtypes.length)];

    switch (selectedType) {
      case 'syntaxError':
        this.recordError(ErrorType.JSON_SYNTAX, agentType, 'Injected syntax error');
        return output.replace(/[{}]/g, (match) => this.randomGenerator() > 0.5 ? '' : match);
      
      case 'typeError':
        this.recordError(ErrorType.JSON_TYPE, agentType, 'Injected type error');
        return output.replace(/":\s*"[^"]*"/g, '": 12345'); // Replace strings with numbers
      
      case 'missingFields':
        this.recordError(ErrorType.JSON_MISSING_FIELDS, agentType, 'Injected missing fields');
        return output.replace(/"technicalApproach":[^,}]*,?/g, ''); // Remove required field
      
      case 'unexpectedStructure':
        this.recordError(ErrorType.JSON_UNEXPECTED_STRUCTURE, agentType, 'Injected unexpected structure');
        return '{"error": "This is not the JSON you are looking for"}';
      
      case 'truncatedJson':
        this.recordError(ErrorType.JSON_TRUNCATED, agentType, 'Injected truncated JSON');
        return output.substring(0, Math.floor(output.length * 0.7));
      
      case 'invalidCharacters':
        this.recordError(ErrorType.JSON_INVALID_CHARS, agentType, 'Injected invalid characters');
        return output.replace(/"/g, '"').replace(/}/g, '﹜'); // Unicode lookalikes
      
      default:
        return output;
    }
  }

  // API Communication Error Injection
  injectApiCommunicationError(agentType: string): { shouldFail: boolean; error?: Error } {
    if (!this.shouldInjectError(agentType)) return { shouldFail: false };
    if (!this.config.errorTypes.apiCommunication.enabled) return { shouldFail: false };

    const enabledSubtypes = Object.entries(this.config.errorTypes.apiCommunication.subtypes)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type);

    if (enabledSubtypes.length === 0) return { shouldFail: false };

    const selectedType = enabledSubtypes[Math.floor(this.randomGenerator() * enabledSubtypes.length)];

    switch (selectedType) {
      case 'timeout':
        this.recordError(ErrorType.API_TIMEOUT, agentType, 'Injected timeout error');
        return { 
          shouldFail: true, 
          error: new Error('Command timed out after 30 minutes') 
        };
      
      case 'connectionRefused':
        this.recordError(ErrorType.API_CONNECTION_REFUSED, agentType, 'Injected connection refused');
        return { 
          shouldFail: true, 
          error: new Error('spawn ENOENT: Claude executable not found') 
        };
      
      case 'invalidResponse':
        this.recordError(ErrorType.API_INVALID_RESPONSE, agentType, 'Injected invalid response');
        return { shouldFail: false }; // Let JSON parser handle the invalid response
      
      case 'partialResponse':
        this.recordError(ErrorType.API_PARTIAL_RESPONSE, agentType, 'Injected partial response');
        return { shouldFail: false }; // Will be handled by truncating output
      
      case 'maxBufferExceeded':
        this.recordError(ErrorType.API_MAX_BUFFER, agentType, 'Injected max buffer exceeded');
        return { 
          shouldFail: true, 
          error: new Error('stdout maxBuffer length exceeded') 
        };
      
      default:
        return { shouldFail: false };
    }
  }

  // State Management Error Injection
  injectStateManagementError(operation: string, agentType: string): { shouldFail: boolean; error?: Error } {
    if (!this.shouldInjectError(agentType)) return { shouldFail: false };
    if (!this.config.errorTypes.stateManagement.enabled) return { shouldFail: false };

    const enabledSubtypes = Object.entries(this.config.errorTypes.stateManagement.subtypes)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type);

    if (enabledSubtypes.length === 0) return { shouldFail: false };

    const selectedType = enabledSubtypes[Math.floor(this.randomGenerator() * enabledSubtypes.length)];

    switch (selectedType) {
      case 'databaseLocked':
        this.recordError(ErrorType.DB_LOCKED, agentType, `Database locked during ${operation}`);
        return { 
          shouldFail: true, 
          error: new Error('SQLITE_BUSY: database is locked') 
        };
      
      case 'transactionFailed':
        this.recordError(ErrorType.DB_TRANSACTION_FAILED, agentType, `Transaction failed during ${operation}`);
        return { 
          shouldFail: true, 
          error: new Error('Transaction rolled back due to constraint violation') 
        };
      
      case 'invalidStateTransition':
        this.recordError(ErrorType.DB_INVALID_STATE, agentType, `Invalid state transition during ${operation}`);
        return { 
          shouldFail: true, 
          error: new Error('Invalid state transition: cannot move from done to in_progress') 
        };
      
      case 'concurrencyConflict':
        this.recordError(ErrorType.DB_CONCURRENCY, agentType, `Concurrency conflict during ${operation}`);
        return { 
          shouldFail: true, 
          error: new Error('Work item is already being processed by another agent') 
        };
      
      default:
        return { shouldFail: false };
    }
  }
}

// Export singleton instance
export const errorSimulator = ErrorSimulationEngine.getInstance();