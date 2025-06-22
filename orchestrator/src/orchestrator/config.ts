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