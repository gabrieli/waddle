/**
 * Work Items API Routes (Minimal Implementation for US-003)
 */

export interface AssignableWork {
  id: number;
  type: 'epic' | 'user_story' | 'bug';
  status: 'new' | 'in_progress' | 'review' | 'done';
}

export interface WorkItemService {
  getAssignable(): Promise<AssignableWork[]>;
  assign(workItemId: number, agentId: number): Promise<boolean>;
}

/**
 * Factory function to create work items router with dependency injection
 */
export function createWorkItemsRouter(service: WorkItemService) {
  // Return a simple router object for now
  // In full implementation, this would be an Express router
  return {
    service,
    routes: {
      'GET /assignable': service.getAssignable,
      'PATCH /:id': service.assign
    }
  };
}