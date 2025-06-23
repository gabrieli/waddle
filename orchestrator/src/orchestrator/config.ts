import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LoggerConfig, LogLevel } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface OrchestratorConfig {
  pollingInterval: number;
  claudeExecutable: string;
  workingDirectory: string;
  database: string;
  parallelMode?: boolean;
  maxConcurrentManagers?: number;
  maxConcurrentDevelopers?: number;
  maxBufferMB?: number; // Maximum buffer size for Claude output in MB
  timeoutSimulation?: { // Configuration for timeout simulation testing
    enabled: boolean;
    delayMs?: number; // Artificial delay to inject (ms)
    operations?: string[]; // Which operations to delay (e.g., ['architect', 'manager'])
  };
  errorInjection?: {
    enabled: boolean;
    targetAgents: string[]; // Which agents to inject errors for
    injectionRate: number; // Percentage of requests to inject errors (0-100)
    errorTypes: {
      syntaxError?: boolean; // Malformed JSON syntax
      typeError?: boolean; // Wrong data types
      missingFields?: boolean; // Required fields missing
      unexpectedStructure?: boolean; // Completely wrong structure
      truncatedJson?: boolean; // Incomplete JSON
      invalidCharacters?: boolean; // Non-JSON characters
    };
    seed?: number; // For reproducible error injection
  };
  agents: {
    manager: { model: string };
    architect: { model: string };
    developer: { model: string };
    code_quality_reviewer?: { model: string };
    reviewer?: { model: string }; // For backwards compatibility
  };
  logging?: {
    level: string;
    logToFile: boolean;
    logToConsole: boolean;
    logFilePath: string;
    includeTimestamp: boolean;
    includeStackTrace: boolean;
    maxFileSize: number;
  };
  resourceExhaustion?: {
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
      errorRate: number;
      errorTypes: ('timeout' | 'parse' | 'api')[];
    };
  };
  // Historical context configuration
  enableHistoricalContext?: boolean;
  maxContextLength?: number;
  contextLookbackHours?: number;
  contextCacheTTLMinutes?: number;
  // A/B testing configuration
  abTesting?: {
    enabled: boolean;
    contextEnabledPercent: number; // Percentage of requests to enable context (0-100)
    seed?: number; // For reproducible A/B testing
  };
}

export function loadConfig(): OrchestratorConfig {
  const configPath = path.join(__dirname, '../../orchestrator.config.json');
  
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData) as OrchestratorConfig;
    
    // Validate required fields
    if (!config.pollingInterval || config.pollingInterval < 1000) {
      throw new Error('Invalid polling interval (must be >= 1000ms)');
    }
    
    if (!config.database) {
      throw new Error('Database path is required');
    }
    
    return config;
  } catch (error) {
    console.error('Failed to load configuration:', error);
    throw error;
  }
}

export function getLoggerConfig(config: OrchestratorConfig): Partial<LoggerConfig> | undefined {
  if (!config.logging) {
    return undefined;
  }
  
  // Convert string log level to LogLevel enum
  const levelMap: Record<string, LogLevel> = {
    'DEBUG': LogLevel.DEBUG,
    'INFO': LogLevel.INFO,
    'WARN': LogLevel.WARN,
    'ERROR': LogLevel.ERROR
  };
  
  const level = levelMap[config.logging.level.toUpperCase()] || LogLevel.INFO;
  
  // Resolve log file path relative to orchestrator directory
  const logFilePath = path.isAbsolute(config.logging.logFilePath)
    ? config.logging.logFilePath
    : path.join(__dirname, '../..', config.logging.logFilePath);
  
  return {
    level,
    logToFile: config.logging.logToFile,
    logToConsole: config.logging.logToConsole,
    logFilePath,
    includeTimestamp: config.logging.includeTimestamp,
    includeStackTrace: config.logging.includeStackTrace,
    maxFileSize: config.logging.maxFileSize
  };
}