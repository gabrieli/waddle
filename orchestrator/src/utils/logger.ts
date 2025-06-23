import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerConfig {
  level: LogLevel;
  logToFile: boolean;
  logToConsole: boolean;
  logFilePath?: string;
  includeTimestamp: boolean;
  includeStackTrace: boolean;
  maxFileSize?: number; // in MB
}

export interface LogContext {
  operation?: string;
  duration?: number;
  query?: string;
  params?: any;
  result?: any;
  error?: Error;
  workItemId?: string;
  transactionId?: string;
  [key: string]: any;
}

class Logger {
  private config: LoggerConfig;
  private logStream?: fs.WriteStream;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      logToFile: false,
      logToConsole: true,
      includeTimestamp: true,
      includeStackTrace: true,
      maxFileSize: 100, // 100MB default
      ...config,
    };

    if (this.config.logToFile && this.config.logFilePath) {
      this.initializeFileLogging();
    }
  }

  private initializeFileLogging() {
    if (!this.config.logFilePath) return;

    const logDir = path.dirname(this.config.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logStream = fs.createWriteStream(this.config.logFilePath, {
      flags: 'a',
      encoding: 'utf8',
    });

    // Rotate log file if it exceeds max size
    this.checkAndRotateLogFile();
  }

  private checkAndRotateLogFile() {
    if (!this.config.logFilePath || !this.config.maxFileSize) return;

    try {
      const stats = fs.statSync(this.config.logFilePath);
      const fileSizeInMB = stats.size / (1024 * 1024);

      if (fileSizeInMB > this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${this.config.logFilePath}.${timestamp}`;
        fs.renameSync(this.config.logFilePath, rotatedPath);
        
        // Recreate the log stream
        if (this.logStream) {
          this.logStream.end();
          this.initializeFileLogging();
        }
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const levelName = LogLevel[level];
    const timestamp = this.config.includeTimestamp ? new Date().toISOString() : '';
    
    let formattedMessage = this.config.includeTimestamp 
      ? `[${timestamp}] [${levelName}] ${message}`
      : `[${levelName}] ${message}`;

    if (context) {
      const contextStr = this.formatContext(context);
      formattedMessage += ` ${contextStr}`;
    }

    return formattedMessage;
  }

  private formatContext(context: LogContext): string {
    const parts: string[] = [];

    if (context.operation) {
      parts.push(`operation=${context.operation}`);
    }

    if (context.duration !== undefined) {
      parts.push(`duration=${context.duration}ms`);
    }

    if (context.query) {
      parts.push(`query="${context.query}"`);
    }

    if (context.params !== undefined) {
      parts.push(`params=${JSON.stringify(context.params)}`);
    }

    if (context.workItemId) {
      parts.push(`workItemId=${context.workItemId}`);
    }

    if (context.transactionId) {
      parts.push(`transactionId=${context.transactionId}`);
    }

    // Add any additional context fields
    Object.keys(context).forEach(key => {
      if (!['operation', 'duration', 'query', 'params', 'result', 'error', 'workItemId', 'transactionId'].includes(key)) {
        parts.push(`${key}=${JSON.stringify(context[key])}`);
      }
    });

    return parts.length > 0 ? `{${parts.join(', ')}}` : '';
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (level < this.config.level) return;

    const formattedMessage = this.formatMessage(level, message, context);

    if (this.config.logToConsole) {
      const consoleMethod = level === LogLevel.ERROR ? console.error : console.log;
      consoleMethod(formattedMessage);

      if (context?.error && this.config.includeStackTrace) {
        console.error(context.error.stack);
      }
    }

    if (this.config.logToFile && this.logStream) {
      this.logStream.write(formattedMessage + '\n');
      
      if (context?.error && this.config.includeStackTrace) {
        this.logStream.write(context.error.stack + '\n');
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context);
  }

  // Database-specific logging methods
  logQuery(query: string, params?: any, duration?: number) {
    const context: LogContext = {
      operation: 'query',
      query,
      params,
      duration,
    };

    // Log slow queries as warnings
    if (duration && duration > 100) {
      this.warn(`Slow query detected (${duration}ms)`, context);
    } else {
      this.debug('Query executed', context);
    }
  }

  logTransaction(transactionId: string, action: 'begin' | 'commit' | 'rollback', context?: LogContext) {
    this.info(`Transaction ${action}`, {
      ...context,
      operation: 'transaction',
      transactionId,
      action,
    });
  }

  logConnection(event: 'connected' | 'disconnected' | 'error', context?: LogContext) {
    const level = event === 'error' ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `Database ${event}`, {
      ...context,
      operation: 'connection',
      event,
    });
  }

  // Helper method to measure operation duration
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.debug(`Operation completed: ${operation}`, {
        ...context,
        operation,
        duration,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.error(`Operation failed: ${operation}`, {
        ...context,
        operation,
        duration,
        error: error as Error,
      });
      
      throw error;
    }
  }

  // Clean up resources
  close() {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = undefined;
    }
  }
}

// Create a singleton instance
let loggerInstance: Logger | null = null;

export function createLogger(config?: Partial<LoggerConfig>): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(config);
  }
  return loggerInstance;
}

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

export function updateLoggerConfig(config: Partial<LoggerConfig>) {
  const logger = getLogger();
  // Close existing logger and create new one with updated config
  logger.close();
  loggerInstance = new Logger({ ...logger['config'], ...config });
  return loggerInstance;
}

// Export default instance
export default getLogger();