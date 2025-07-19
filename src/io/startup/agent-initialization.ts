/**
 * Server startup integration for agent initialization
 * IO layer - orchestrates startup sequence
 */

import * as AgentInit from '../../core/workflows/agent-initialization.ts';
import { createAgentRepository } from '../repositories/agent-repository.ts';

/**
 * Startup configuration
 */
export interface StartupConfig {
  // No external dependencies needed for repository pattern
}

/**
 * Initialize agents during server startup
 */
export async function initializeAgentsOnStartup(config?: StartupConfig): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting agent initialization...`);

  try {
    // Create agent repository for direct database access
    const agentRepository = createAgentRepository();

    // Initialize agents
    const result = await AgentInit.initializeAgents({
      agentRepository,
      agentTypes: ['developer', 'architect', 'tester', 'reviewer']
    });

    if (!result.success) {
      throw new Error(`Agent initialization failed: ${result.error}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Agent initialization completed successfully:`);
    console.log(`  - Agents created: ${result.agentsCreated}`);
    console.log(`  - Work items reset: ${result.workItemsReset}`);
    console.log(`  - System ready: ${result.systemReady}`);
    console.log(`  - Duration: ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Agent initialization failed after ${duration}ms:`, error.message);
    throw error;
  }
}