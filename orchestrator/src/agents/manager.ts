import { WorkItem, ManagerDecision } from '../types/index.js';
import { getAllWorkItems, getAvailableWorkItems, updateWorkItemStatus, createWorkItem, generateId, addHistory, getWorkItemHistory, getWorkItem } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildManagerPrompt } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { runArchitectAgent } from './architect.js';
import { runDeveloperAgent } from './developer.js';
import { runCodeQualityReviewerAgent } from './code-quality-reviewer.js';
import { parseAgentJsonResponse } from './json-parser.js';

export interface ManagerDecisionResult {
  decisions: Array<{
    workItemId: string;
    action: string;
    reason: string;
    details?: any;
  }>;
  createNewItems?: Array<{
    type: 'epic' | 'story' | 'task';
    title: string;
    description: string;
    parentId?: string;
  }>;
}

export async function runManagerAgent(config: OrchestratorConfig): Promise<void> {
  console.log('\n🎩 Manager Agent: Analyzing work items...');
  
  try {
    // Get available work items (not currently being processed)
    const workItems = getAvailableWorkItems();
    
    if (workItems.length === 0) {
      console.log('✅ Manager: No available work items found (all are either done or being processed).');
      return;
    }
    
    // Get recent history
    const recentHistory = workItems.slice(0, 5).map(item => {
      const history = getWorkItemHistory(item.id);
      return history.length > 0 
        ? `${item.id}: ${history[0].action} - ${history[0].content}`
        : `${item.id}: No history`;
    }).join('\n');
    
    // Get recent errors for self-healing
    const { getRecentErrors } = await import('../database/utils.js');
    const recentErrors = getRecentErrors(24); // Last 24 hours
    const errorsStr = recentErrors.length > 0
      ? recentErrors.map(e => `- ${e.error.agentType} agent failed on ${e.workItemId}: ${e.error.errorType} - ${e.error.errorMessage}`).join('\n')
      : 'No recent errors';
    
    // Build and execute prompt
    const prompt = buildManagerPrompt(workItems, recentHistory, errorsStr);
    const result = await executeClaudeAgent('manager', prompt, config, config.maxBufferMB);
    
    if (!result.success) {
      console.error('❌ Manager agent failed:', result.error);
      return;
    }
    
    // Parse decision
    const parseResult = parseAgentJsonResponse<ManagerDecisionResult>(result.output, 'manager');
    
    if (!parseResult.success) {
      console.error('❌ Failed to parse manager decision:', parseResult.error);
      console.log('Raw output:', parseResult.rawOutput);
      
      // Record error for self-healing
      const errorDetails = {
        errorType: 'JSON_PARSE_ERROR',
        errorMessage: parseResult.error || 'Unknown parsing error',
        agentType: 'manager',
        expectedFormat: 'ManagerDecisionResult JSON',
        rawOutput: parseResult.rawOutput,
        workItemCount: workItems.length,
        timestamp: new Date().toISOString()
      };
      
      // Create a special work item to track manager errors
      const errorId = generateId('BUG');
      createWorkItem(
        errorId,
        'bug',
        'Manager agent JSON parsing error',
        `The manager agent failed to parse JSON response.\n\nError: ${errorDetails.errorMessage}\n\nThis prevents the manager from making decisions and orchestrating work.`,
        null,
        'backlog'
      );
      addHistory(errorId, 'error', JSON.stringify(errorDetails), 'system');
      
      return;
    }
    
    const decision = parseResult.data!;
    
    // Execute decisions
    console.log(`\n📊 Processing ${decision.decisions.length} decisions...`);
    for (const item of decision.decisions) {
      await executeDecision(item, config);
    }
    
    // Create new items if requested
    if (decision.createNewItems && decision.createNewItems.length > 0) {
      console.log(`\n🆕 Creating ${decision.createNewItems.length} new work items...`);
      for (const newItem of decision.createNewItems) {
        const id = generateId(newItem.type.toUpperCase());
        createWorkItem(
          id,
          newItem.type,
          newItem.title,
          newItem.description,
          newItem.parentId || null,
          'backlog'
        );
        console.log(`✅ Created new ${newItem.type}: ${id} - ${newItem.title}`);
        addHistory(id, 'decision', 'Created by manager agent', 'manager');
      }
    }
    
  } catch (error) {
    console.error('❌ Manager agent error:', error);
    if (error instanceof Error) {
      console.error('   Stack trace:', error.stack);
    }
  }
}

async function executeDecision(decision: any, config: OrchestratorConfig): Promise<void> {
  const { workItemId, action, reason } = decision;
  
  console.log(`\n📋 Decision for ${workItemId}: ${action}`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Executing action...`);
  
  try {
    switch (action) {
      case 'mark_complete':
        updateWorkItemStatus(workItemId, 'done', 'manager');
        console.log(`   ✅ Marked as complete`);
        
        // Check if this was a story and update parent epic if needed
        const workItem = getWorkItem(workItemId);
        if (workItem && workItem.type === 'story' && workItem.parent_id) {
          const { updateEpicBasedOnStories } = await import('../database/utils.js');
          updateEpicBasedOnStories(workItem.parent_id, 'manager');
        }
        break;
        
      case 'move_to_ready':
        updateWorkItemStatus(workItemId, 'ready', 'manager');
        console.log(`   ✅ Moved to ready`);
        break;
        
      case 'move_to_in_progress':
        updateWorkItemStatus(workItemId, 'in_progress', 'manager');
        console.log(`   📝 Moved to in_progress`);
        break;
        
      case 'assign_architect':
        console.log(`   🏗️  Assigning to architect`);
        addHistory(workItemId, 'decision', 'Assigned to architect', 'manager');
        await runArchitectAgent(workItemId, config);
        break;
        
      case 'assign_developer':
        console.log(`   💻 Assigning to developer`);
        
        // Check developer concurrency limit
        const { canAssignDeveloper } = await import('../database/utils.js');
        const maxDevelopers = config.maxConcurrentDevelopers || 1;
        
        if (!canAssignDeveloper(maxDevelopers)) {
          console.log(`   ⚠️  Developer limit reached (max: ${maxDevelopers}). Skipping assignment.`);
          addHistory(workItemId, 'decision', `Developer limit reached (max: ${maxDevelopers}), will retry later`, 'manager');
          // Don't change status - leave it in ready so it can be picked up later
        } else {
          addHistory(workItemId, 'decision', 'Assigned to developer', 'manager');
          await runDeveloperAgent(workItemId, config);
        }
        break;
        
      case 'assign_code_quality_reviewer':
        console.log(`   👀 Assigning to code quality reviewer`);
        addHistory(workItemId, 'decision', 'Assigned to code quality reviewer', 'manager');
        await runCodeQualityReviewerAgent(workItemId, config);
        break;
        
      case 'assign_bug_buster':
        console.log(`   👻 Assigning to bug buster`);
        addHistory(workItemId, 'decision', 'Assigned to bug buster', 'manager');
        const { runBugBusterAgent } = await import('./bug-buster.js');
        await runBugBusterAgent(workItemId, config);
        break;
        
      case 'reject_epic':
        console.log(`   ❌ Rejecting epic: ${reason}`);
        updateWorkItemStatus(workItemId, 'done', 'manager');
        addHistory(workItemId, 'decision', `Epic rejected: ${reason}. Not aligned with Waddle vision.`, 'manager');
        console.log(`   ✅ Epic marked as done (rejected)`);
        break;
        
      case 'wait':
        console.log(`   ⏳ Waiting for other work to complete`);
        break;
        
      default:
        console.log(`   ❓ Unknown action: ${action}`);
    }
    
    // Record the decision in history
    addHistory(workItemId, 'decision', JSON.stringify({ action, reason }), 'manager');
    
  } catch (error) {
    console.error(`   ❌ Failed to execute decision:`, error);
  }
}