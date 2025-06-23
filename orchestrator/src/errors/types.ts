// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',        // Informational, doesn't block processing
  MEDIUM = 'medium',  // May cause partial functionality issues
  HIGH = 'high',      // Significant impact, but recoverable
  CRITICAL = 'critical' // System failure, requires immediate attention
}

// Error categories for better organization
export enum ErrorCategory {
  PARSING = 'parsing',           // JSON/data parsing errors
  VALIDATION = 'validation',     // Data validation errors
  COMMUNICATION = 'communication', // API/Agent communication errors
  PROCESSING = 'processing',     // Business logic errors
  SYSTEM = 'system',            // System-level errors (DB, filesystem)
  TIMEOUT = 'timeout',          // Operation timeout errors
  RESOURCE = 'resource',        // Resource exhaustion errors
  CONFIGURATION = 'configuration' // Config-related errors
}

// Base error interface for all agent errors
export interface AgentError {
  id: string;                   // Unique error ID
  timestamp: Date;              // When the error occurred
  agentType: string;           // Which agent generated the error
  workItemId?: string;         // Associated work item (if any)
  category: ErrorCategory;     // Error category
  severity: ErrorSeverity;     // Error severity
  code: string;               // Machine-readable error code
  message: string;            // Human-readable error message
  context: Record<string, any>; // Additional context data
  stackTrace?: string;        // Stack trace for debugging
  recoveryActions?: RecoveryAction[]; // Suggested recovery actions
  metadata?: ErrorMetadata;   // Additional metadata
}

// Recovery action interface
export interface RecoveryAction {
  type: 'retry' | 'skip' | 'manual' | 'automatic';
  description: string;
  command?: string;           // Optional command to execute
  delay?: number;            // Delay before retry (ms)
  maxAttempts?: number;      // Max retry attempts
}

// Error metadata for additional information
export interface ErrorMetadata {
  attempts?: number;          // Number of attempts made
  duration?: number;          // Operation duration (ms)
  inputSize?: number;         // Size of input data
  outputSize?: number;        // Size of output data
  memoryUsage?: number;       // Memory usage at error time
  relatedErrors?: string[];   // Related error IDs
}

// Specific error types for common scenarios
export class ArchitectError extends Error implements AgentError {
  id: string;
  timestamp: Date;
  agentType: string = 'architect';
  workItemId?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  context: Record<string, any>;
  stackTrace?: string;
  recoveryActions?: RecoveryAction[];
  metadata?: ErrorMetadata;

  constructor(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: Record<string, any> = {},
    workItemId?: string
  ) {
    super(message);
    this.id = `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.timestamp = new Date();
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.workItemId = workItemId;
    this.stackTrace = this.stack;
    
    // Set proper prototype chain
    Object.setPrototypeOf(this, ArchitectError.prototype);
  }

  toJSON(): AgentError {
    return {
      id: this.id,
      timestamp: this.timestamp,
      agentType: this.agentType,
      workItemId: this.workItemId,
      category: this.category,
      severity: this.severity,
      code: this.code,
      message: this.message,
      context: this.context,
      stackTrace: this.stackTrace,
      recoveryActions: this.recoveryActions,
      metadata: this.metadata
    };
  }
}

// Predefined error codes for consistency
export const ErrorCodes = {
  // Parsing errors
  JSON_PARSE_FAILED: 'JSON_PARSE_FAILED',
  JSON_STRUCTURE_INVALID: 'JSON_STRUCTURE_INVALID',
  JSON_MISSING_FIELDS: 'JSON_MISSING_FIELDS',
  
  // Validation errors
  INVALID_WORK_ITEM_TYPE: 'INVALID_WORK_ITEM_TYPE',
  INVALID_EPIC_FORMAT: 'INVALID_EPIC_FORMAT',
  MISSING_REQUIRED_DATA: 'MISSING_REQUIRED_DATA',
  
  // Communication errors
  CLAUDE_EXECUTION_FAILED: 'CLAUDE_EXECUTION_FAILED',
  CLAUDE_TIMEOUT: 'CLAUDE_TIMEOUT',
  CLAUDE_BUFFER_OVERFLOW: 'CLAUDE_BUFFER_OVERFLOW',
  
  // Processing errors
  WORK_ITEM_LOCKED: 'WORK_ITEM_LOCKED',
  WORK_ITEM_NOT_FOUND: 'WORK_ITEM_NOT_FOUND',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
  MEMORY_EXHAUSTION: 'MEMORY_EXHAUSTION',
  
  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_CONFIG: 'MISSING_CONFIG'
} as const;

// Type for error codes
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];