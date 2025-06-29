import { WorkItem } from '../types/index.js';
import { getWorkItem, updateWorkItemStatus, claimWorkItem, releaseWorkItem, addHistory, getWorkItemHistory } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { runArchitectAgent } from './architect.js';
import { runDeveloperAgent } from './developer.js';
import { runCodeQualityReviewerAgent } from './code-quality-reviewer.js';

export interface SingleItemDecision {
  action: string;
  reason: string;
  details?: any;
}

const SINGLE_ITEM_MANAGER_PROMPT = `You are a Development Manager analyzing a single work item.

WORK ITEM:
{workItem}

RECENT HISTORY:
{history}

RULES:
- Epic in backlog → assign_architect
- Epic with stories in ready/in_progress → move epic to in_progress and skip (focus on stories)
- Epic where all stories are done → mark_complete
- Story in ready → assign_developer  
- Story in review → assign_code_quality_reviewer
- Work that's been reviewed and approved → mark_complete
- If dependencies aren't met → wait

Analyze this ONE item and decide the next action.

Return ONLY valid JSON:
{
  "action": "assign_architect|assign_developer|assign_code_quality_reviewer|mark_complete|move_to_in_progress|wait",
  "reason": "brief reason for the decision"
}`;

export async function runSingleManagerAgent(workItemId: string, config: OrchestratorConfig): Promise<void> {
  const agentId = `manager-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
  
  try {
    // Try to claim the work item
    if (!claimWorkItem(workItemId, agentId)) {
      console.log(`⚠️  Work item ${workItemId} is already being processed`);
      return;
    }
    
    console.log(`\n🎩 Manager Agent: Analyzing ${workItemId}...`);
    
    // Get the work item
    const workItem = getWorkItem(workItemId);
    if (!workItem) {
      console.error(`❌ Work item ${workItemId} not found`);
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Get recent history
    const history = getWorkItemHistory(workItemId);
    const recentHistory = history.slice(0, 3).map(h => 
      `${h.action}: ${h.content || 'No details'} (by ${h.created_by})`
    ).join('\n');
    
    // Build prompt
    const workItemStr = `Type: ${workItem.type}
ID: ${workItem.id}
Title: ${workItem.title}
Status: ${workItem.status}
Description: ${workItem.description || 'No description'}`;
    
    const prompt = SINGLE_ITEM_MANAGER_PROMPT
      .replace('{workItem}', workItemStr)
      .replace('{history}', recentHistory || 'No recent history');
    
    // Execute Claude
    const result = await executeClaudeAgent('manager', prompt, config);
    
    if (!result.success) {
      console.error('❌ Manager agent failed:', result.error);
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Parse decision
    let decision: SingleItemDecision;
    try {
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      decision = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('❌ Failed to parse manager decision:', e);
      console.log('Raw output:', result.output);
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Execute decision
    console.log(`\n📋 Decision for ${workItemId}: ${decision.action}`);
    console.log(`   Reason: ${decision.reason}`);
    
    // Record decision in history
    addHistory(workItemId, 'decision', JSON.stringify(decision), 'manager');
    
    // Release the work item before calling other agents
    releaseWorkItem(workItemId, agentId);
    
    // Execute the action
    switch (decision.action) {
      case 'assign_architect':
        console.log(`   🏗️  Assigning to architect`);
        await runArchitectAgent(workItemId, config);
        break;
        
      case 'assign_developer':
        console.log(`   💻 Assigning to developer`);
        await runDeveloperAgent(workItemId, config);
        break;
        
      case 'assign_code_quality_reviewer':
        console.log(`   👀 Assigning to code quality reviewer`);
        await runCodeQualityReviewerAgent(workItemId, config);
        break;
        
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
        
      case 'move_to_in_progress':
        updateWorkItemStatus(workItemId, 'in_progress', 'manager');
        console.log(`   📝 Moved to in_progress`);
        break;
        
      case 'wait':
        console.log(`   ⏳ Waiting for dependencies`);
        break;
        
      default:
        console.log(`   ❓ Unknown action: ${decision.action}`);
    }
    
  } catch (error) {
    console.error(`❌ Manager agent error for ${workItemId}:`, error);
    // Try to release if we still hold the lock
    releaseWorkItem(workItemId, agentId);
  }
}