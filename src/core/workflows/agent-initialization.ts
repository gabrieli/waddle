/**
 * Agent Initialization workflow
 */

export type AgentType = 'developer' | 'architect' | 'tester';

export interface AgentRepository {
  clearAll(): Promise<number>;
  create(type: AgentType): Promise<number>;
  clearWorkItemAssignments(): Promise<number>;
}

export interface AgentInitializationConfig {
  agentRepository: AgentRepository;
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
    const deletedCount = await config.agentRepository.clearAll();

    // Step 2: Create new agents
    let agentsCreated = 0;
    for (const agentType of config.agentTypes) {
      await config.agentRepository.create(agentType);
      agentsCreated++;
    }

    // Step 3: Reset interrupted work items
    const updatedWorkItems = await config.agentRepository.clearWorkItemAssignments();

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