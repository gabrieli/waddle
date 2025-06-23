export interface ErrorSimulationConfig {
  enabled: boolean;
  targetAgents: string[]; // Which agents to inject errors for
  injectionRate: number; // Percentage of requests to inject errors (0-100)
  errorTypes: {
    jsonParsing: {
      enabled: boolean;
      subtypes: {
        syntaxError: boolean;
        typeError: boolean;
        missingFields: boolean;
        unexpectedStructure: boolean;
        truncatedJson: boolean;
        invalidCharacters: boolean;
      };
    };
    apiCommunication: {
      enabled: boolean;
      subtypes: {
        timeout: boolean;
        connectionRefused: boolean;
        invalidResponse: boolean;
        partialResponse: boolean;
        maxBufferExceeded: boolean;
      };
    };
    stateManagement: {
      enabled: boolean;
      subtypes: {
        databaseLocked: boolean;
        transactionFailed: boolean;
        invalidStateTransition: boolean;
        concurrencyConflict: boolean;
      };
    };
  };
  seed?: number; // For reproducible error injection
}

export interface ErrorSimulationProfile {
  name: string;
  description: string;
  config: ErrorSimulationConfig;
  createdAt: Date;
  lastUsed?: Date;
}

export interface ErrorSimulationStats {
  totalRequests: number;
  errorsInjected: number;
  errorsByType: Record<string, number>;
  errorsByAgent: Record<string, number>;
  lastError?: {
    timestamp: Date;
    agent: string;
    errorType: string;
    details: string;
  };
  startTime: Date;
}

export interface ErrorSimulationDashboard {
  currentConfig: ErrorSimulationConfig;
  stats: ErrorSimulationStats;
  profiles: ErrorSimulationProfile[];
  isActive: boolean;
}

export enum ErrorType {
  JSON_SYNTAX = 'json_syntax',
  JSON_TYPE = 'json_type',
  JSON_MISSING_FIELDS = 'json_missing_fields',
  JSON_UNEXPECTED_STRUCTURE = 'json_unexpected_structure',
  JSON_TRUNCATED = 'json_truncated',
  JSON_INVALID_CHARS = 'json_invalid_chars',
  API_TIMEOUT = 'api_timeout',
  API_CONNECTION_REFUSED = 'api_connection_refused',
  API_INVALID_RESPONSE = 'api_invalid_response',
  API_PARTIAL_RESPONSE = 'api_partial_response',
  API_MAX_BUFFER = 'api_max_buffer',
  DB_LOCKED = 'db_locked',
  DB_TRANSACTION_FAILED = 'db_transaction_failed',
  DB_INVALID_STATE = 'db_invalid_state',
  DB_CONCURRENCY = 'db_concurrency'
}