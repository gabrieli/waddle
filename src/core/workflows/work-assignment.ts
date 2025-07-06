/**
 * Work Assignment Core Logic (Pure Functions)
 */

export interface Agent {
  id: number;
  type: 'developer' | 'architect' | 'tester';
}

export interface AssignableWork {
  id: number;
  type: 'epic' | 'user_story' | 'bug';
  status: 'new' | 'in_progress' | 'review' | 'done';
}

export interface Assignment {
  agentId: number;
  workItemId: number;
}

export interface AssignmentRule {
  agentType: 'developer' | 'architect' | 'tester';
  workType: 'epic' | 'user_story' | 'bug';
  workStatus: 'new' | 'in_progress' | 'review' | 'done';
}

/**
 * Match available agents to assignable work based on rules
 * Pure function - no side effects
 */
export function matchAgentsToWork(
  agents: Agent[],
  work: AssignableWork[],
  rules: AssignmentRule[]
): Assignment[] {
  const assignments: Assignment[] = [];
  
  // Create a copy of available agents to track assignments
  const availableAgents = [...agents];
  
  for (const workItem of work) {
    // Find a matching rule for this work item
    const matchingRule = rules.find(rule => 
      rule.workType === workItem.type && 
      rule.workStatus === workItem.status
    );
    
    if (!matchingRule) continue;
    
    // Find an available agent of the right type
    const agentIndex = availableAgents.findIndex(agent => 
      agent.type === matchingRule.agentType
    );
    
    if (agentIndex !== -1) {
      const agent = availableAgents[agentIndex];
      assignments.push({
        agentId: agent.id,
        workItemId: workItem.id
      });
      
      // Remove agent from available pool (one assignment per agent)
      availableAgents.splice(agentIndex, 1);
    }
  }
  
  return assignments;
}