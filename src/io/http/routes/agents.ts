/**
 * Agents API Routes (Minimal Implementation for US-003)
 */

export interface Agent {
  id: number;
  type: 'developer' | 'architect' | 'tester';
}

export interface AgentService {
  getAvailable(): Promise<Agent[]>;
}

/**
 * Factory function to create agents router with dependency injection
 */
export function createAgentsRouter(service: AgentService) {
  // Return a simple router object for now
  // In full implementation, this would be an Express router
  return {
    service,
    routes: {
      'GET /available': service.getAvailable
    }
  };
}