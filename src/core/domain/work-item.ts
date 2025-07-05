/**
 * Work Item domain model
 */

export type WorkItemStatus = 'new' | 'in_progress' | 'review' | 'done';
export type WorkItemType = 'epic' | 'user_story' | 'bug';
export type AgentType = 'developer' | 'architect' | 'tester';

export interface WorkItem {
  id: number;
  name: string;
  status: WorkItemStatus;
  description?: string;
  type: WorkItemType;
  assigned_to?: AgentType;
  agent_id?: number;
  parent_id?: number;
  branch_name?: string;
  worktree_path?: string;
  version: number;
  started_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: number;
  type: AgentType;
  work_item_id?: number;
  version: number;
  created_at: Date;
}

export interface StateTransition {
  id: number;
  work_item_id: number;
  from_state?: WorkItemStatus;
  to_state: WorkItemStatus;
  event?: string;
  agent_type?: AgentType;
  created_at: Date;
}

/**
 * Work item validation functions
 */
export function isValidWorkItemStatus(status: string): status is WorkItemStatus {
  return ['new', 'in_progress', 'review', 'done'].includes(status);
}

export function isValidWorkItemType(type: string): type is WorkItemType {
  return ['epic', 'user_story', 'bug'].includes(type);
}

export function isValidAgentType(type: string): type is AgentType {
  return ['developer', 'architect', 'tester'].includes(type);
}

export function isValidBranchName(branchName: string): boolean {
  const pattern = /^feature\/work-item-\d+-[a-z0-9-]+$/;
  return pattern.test(branchName);
}

/**
 * Generate branch name from work item
 */
export function generateBranchName(workItemId: number, slug: string): string {
  const sanitizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `feature/work-item-${workItemId}-${sanitizedSlug}`;
}

/**
 * Work item factory functions
 */
export function createWorkItem(
  name: string,
  type: WorkItemType,
  description?: string,
  parentId?: number
): Omit<WorkItem, 'id' | 'created_at' | 'updated_at'> {
  return {
    name,
    status: 'new',
    description,
    type,
    parent_id: parentId,
    version: 1
  };
}

export function createAgent(type: AgentType): Omit<Agent, 'id' | 'created_at'> {
  return {
    type,
    version: 1
  };
}