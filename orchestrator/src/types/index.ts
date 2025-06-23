export type WorkItemType = 'epic' | 'story' | 'task' | 'bug';
export type WorkItemStatus = 'backlog' | 'ready' | 'in_progress' | 'review' | 'done';
export type AgentRole = 'manager' | 'architect' | 'developer' | 'reviewer' | 'bug-buster';
export type HistoryAction = 'status_change' | 'agent_output' | 'decision' | 'error';

export interface WorkItem {
  id: string;
  type: WorkItemType;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  assigned_role: AgentRole | null;
  processing_started_at: string | null;
  processing_agent_id: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface WorkHistory {
  id: number;
  work_item_id: string;
  action: HistoryAction;
  content: string | null;
  created_by: string;
  created_at: string;
}

export interface ManagerDecision {
  action: 'assign_architect' | 'assign_developer' | 'assign_reviewer' | 'assign_bug_buster' | 'mark_complete' | 'create_improvement' | 'wait';
  workItemId?: string;
  improvementType?: WorkItemType;
  improvementTitle?: string;
  improvementDescription?: string;
  parentId?: string;
}