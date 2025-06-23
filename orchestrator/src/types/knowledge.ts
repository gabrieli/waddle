import { AgentRole } from './index.js';

export type PatternType = 'solution' | 'approach' | 'tool_usage' | 'error_handling' | 'optimization';
export type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';
export type ReviewStatus = 'approved' | 'needs_changes' | 'rejected' | 'pending' | 'needs_revision';
export type ReviewType = 'code' | 'architecture' | 'security' | 'testing' | 'documentation' | 'performance';
export type MessageType = 'question' | 'insight' | 'warning' | 'handoff';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type MessagePriority = Priority;
export type MessageStatus = 'pending' | 'delivered' | 'read' | 'processed' | 'failed';

export interface Pattern {
  id: string;
  agent_role: AgentRole;
  pattern_type: PatternType;
  context: string;
  solution: string;
  effectiveness_score: number;
  usage_count: number;
  work_item_ids: string | null;
  metadata: string | null;
  embedding: string | null;
  created_at: string;
  updated_at: string;
}

export interface ADR {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string | null;
  status: ADRStatus;
  work_item_id: string | null;
  created_by: string;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  work_item_id: string;
  reviewer_role: AgentRole;
  review_type: ReviewType;
  status: ReviewStatus;
  feedback: string;
  suggestions: string | null;
  quality_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface AgentCommunication {
  id: string;
  from_agent: string;
  to_agent: string;
  message_type: MessageType;
  subject: string;
  content: string;
  work_item_id: string | null;
  priority: Priority;
  status: MessageStatus;
  retry_count: number;
  last_retry_at: string | null;
  error_message: string | null;
  is_dead_letter: boolean;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  processed_at: string | null;
}

export interface PatternMetadata {
  tags?: string[];
  category?: string;
  references?: string[];
  performance_metrics?: Record<string, any>;
  [key: string]: any;
}

export interface PatternFilter {
  agent_role?: AgentRole;
  pattern_type?: PatternType;
  min_effectiveness_score?: number;
  max_results?: number;
  include_embeddings?: boolean;
  work_item_ids?: string[];
}

export interface PatternCreateParams {
  agent_role: AgentRole;
  pattern_type: PatternType;
  context: string;
  solution: string;
  effectiveness_score?: number;
  work_item_ids?: string[];
  metadata?: PatternMetadata;
  embedding?: string;
}

export interface ADRCreateParams {
  title: string;
  context: string;
  decision: string;
  consequences?: string;
  status?: ADRStatus;
  work_item_id?: string;
  created_by: string;
}

export interface ReviewCreateParams {
  work_item_id: string;
  reviewer_role: AgentRole;
  review_type: ReviewType;
  status: ReviewStatus;
  feedback: string;
  suggestions?: string;
  quality_score?: number;
}

export interface MessageCreateParams {
  from_agent: string;
  to_agent: string;
  message_type: MessageType;
  subject: string;
  content: string;
  work_item_id?: string;
  priority?: Priority;
  metadata?: Record<string, any>;
}