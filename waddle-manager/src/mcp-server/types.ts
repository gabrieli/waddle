/**
 * MCP (Model Context Protocol) types for Waddle
 * Following JSON-RPC 2.0 specification
 */

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id: string | number | null;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JSONRPCError;
  id: string | number | null;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

// Standard JSON-RPC 2.0 error codes
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom error codes
  FEATURE_NOT_FOUND: -32001,
  INVALID_STATUS: -32002,
  DATABASE_ERROR: -32003,
  VALIDATION_ERROR: -32004,
} as const;

// MCP Tool definitions
export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  handler: (params: unknown) => Promise<unknown>;
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

// Tool parameter types
export interface CreateFeatureParams {
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface GetProgressParams {
  featureId?: string;
}

export interface QueryFeaturesParams {
  status?: string | string[];
  priority?: string | string[];
  limit?: number;
  offset?: number;
}

export interface PauseWorkParams {
  featureId?: string;
}

export interface ResumeWorkParams {
  featureId?: string;
}

export interface SetFeaturePriorityParams {
  featureId: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

// Response types
export interface FeatureCreatedResponse {
  id: string;
  message: string;
}

export interface ProgressResponse {
  features: Array<{
    id: string;
    description: string;
    status: string;
    priority: string;
    progress: number;
    activeTasks: number;
    completedTasks: number;
    createdAt: string;
    updatedAt: string;
  }>;
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
}

export interface SystemStatusResponse {
  running: boolean;
  paused: boolean;
  activeFeatures: number;
  queuedTasks: number;
  completedToday: number;
  uptime: number;
}