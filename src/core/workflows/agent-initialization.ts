/**
 * Agent Initialization workflow
 */

export type AgentType = 'developer' | 'architect' | 'tester';

export interface HttpClient {
  delete(url: string): Promise<{ success: boolean }>;
  post(url: string, data: any): Promise<{ success: boolean; id?: number }>;
  patch(url: string, data: any): Promise<{ success: boolean }>;
}

export interface AgentInitializationConfig {
  httpClient: HttpClient;
  agentTypes: AgentType[];
}

export interface AgentInitializationResult {
  success: boolean;
  agentsCreated?: number;
  workItemsReset?: boolean;
  systemReady?: boolean;
  error?: string;
}

/**
 * Initialize agents on server startup
 * - Clear all existing agents
 * - Create new agents (developer, architect, tester)
 * - Reset any interrupted work items
 */
export async function initializeAgents(config: AgentInitializationConfig): Promise<AgentInitializationResult> {
  try {
    // Step 1: Clear all existing agents
    await config.httpClient.delete('/api/agents');

    // Step 2: Create new agents
    let agentsCreated = 0;
    for (const agentType of config.agentTypes) {
      await config.httpClient.post('/api/agents', { type: agentType });
      agentsCreated++;
    }

    // Step 3: Reset interrupted work items
    await config.httpClient.patch('/api/work-items/assignments', {
      agent_id: null,
      started_at: null
    });

    return {
      success: true,
      agentsCreated,
      workItemsReset: true,
      systemReady: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}