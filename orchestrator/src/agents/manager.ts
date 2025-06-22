import { WorkItem, ManagerDecision } from '../types/index.js';
import { getAllWorkItems, getAvailableWorkItems, updateWorkItemStatus, createWorkItem, generateId, addHistory, getWorkItemHistory } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildManagerPrompt } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { runArchitectAgent } from './architect.js';
import { runDeveloperAgent } from './developer.js';
import { runCodeQualityReviewerAgent } from './code-quality-reviewer.js';

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
    
    // Build and execute prompt
    const prompt = buildManagerPrompt(workItems, recentHistory);
    const result = await executeClaudeAgent('manager', prompt, config);
    
    if (!result.success) {
      console.error('❌ Manager agent failed:', result.error);
      return;
    }
    
    // Parse decision
    let decision: ManagerDecisionResult;
    try {
      // Extract JSON from the output (Claude might include explanation text)
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      decision = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('❌ Failed to parse manager decision:', e);
      console.log('Raw output:', result.output);
      return;
    }
    
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
        addHistory(workItemId, 'decision', 'Assigned to developer', 'manager');
        await runDeveloperAgent(workItemId, config);
        break;
        
      case 'assign_code_quality_reviewer':
        console.log(`   👀 Assigning to code quality reviewer`);
        addHistory(workItemId, 'decision', 'Assigned to code quality reviewer', 'manager');
        await runCodeQualityReviewerAgent(workItemId, config);
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