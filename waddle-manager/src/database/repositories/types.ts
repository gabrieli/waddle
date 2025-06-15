/**
 * Database row types for Waddle repositories
 */

export interface FeatureRow {
  id: string;
  description: string;
  status: string;
  priority: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  metadata: string | null;
}

export interface TaskRow {
  id: number;
  feature_id: string;
  role: string;
  description: string;
  status: string;
  attempts: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  output: string | null;
  error: string | null;
}

export interface TransitionRow {
  id: number;
  entity_type: string;
  entity_id: string;
  from_state: string | null;
  to_state: string;
  reason: string | null;
  actor: string;
  created_at: number;
  metadata: string | null;
}

export interface ContextRow {
  id: number;
  feature_id: string;
  type: string;
  content: string;
  author: string | null;
  created_at: number;
}