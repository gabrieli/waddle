import { WorkItem } from '../types/index.js';
import { getWorkItem, updateWorkItemStatus, addHistory, claimWorkItem, releaseWorkItem, getWorkItemHistory } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildCodeQualityReviewerPrompt } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';

export interface CodeQualityReviewResult {
  status: 'approved' | 'needs_changes';
  feedback: string;
  issues: Array<{
    severity: 'critical' | 'major' | 'minor';
    description: string;
    suggestion: string;
  }>;
  positives: string[];
}

export async function runCodeQualityReviewerAgent(workItemId: string, config: OrchestratorConfig): Promise<void> {
  const agentId = `code-quality-reviewer-${Date.now()}`;
  console.log(`\n👀 Code Quality Reviewer Agent: Reviewing ${workItemId}...`);
  
  try {
    // Try to claim the work item
    if (!claimWorkItem(workItemId, agentId)) {
      console.log('⚠️  Work item is already being processed by another agent');
      return;
    }

    // Get the work item details
    const workItem = getWorkItem(workItemId);
    if (!workItem) {
      console.error('❌ Work item not found');
      releaseWorkItem(workItemId, agentId);
      return;
    }

    // Get implementation details from history
    const history = getWorkItemHistory(workItemId);
    const developerOutput = history.find(h => 
      h.action === 'agent_output' && h.created_by === 'developer'
    );
    
    let implementationDetails = 'No implementation details available';
    if (developerOutput && developerOutput.content) {
      try {
        const impl = JSON.parse(developerOutput.content);
        implementationDetails = `Implementation Notes: ${impl.implementationNotes}\nFiles Changed: ${impl.filesChanged.join(', ')}\nTests Added: ${impl.testsAdded ? 'Yes' : 'No'}`;
      } catch (e) {
        implementationDetails = developerOutput.content;
      }
    }
    
    // Build and execute prompt
    const prompt = buildCodeQualityReviewerPrompt(workItem, implementationDetails);
    const result = await executeClaudeAgent('code-quality-reviewer', prompt, config);
    
    if (!result.success) {
      console.error('❌ Code quality reviewer agent failed:', result.error);
      addHistory(workItemId, 'agent_output', `Review failed: ${result.error}`, 'code-quality-reviewer');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Parse review result
    let review: CodeQualityReviewResult;
    try {
      // Extract JSON from the output (Claude might include explanation text)
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      review = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('❌ Failed to parse code quality review:', e);
      console.log('Raw output:', result.output);
      addHistory(workItemId, 'agent_output', 'Failed to parse review result', 'code-quality-reviewer');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    console.log('\n📋 Code Quality Review Result:');
    console.log(`   Status: ${review.status}`);
    console.log(`   Issues found: ${review.issues.length}`);
    if (review.issues.length > 0) {
      console.log('   Issues:');
      review.issues.forEach(issue => {
        console.log(`     - [${issue.severity}] ${issue.description}`);
      });
    }
    console.log(`   Positive feedback: ${review.positives.length} items`);
    
    // Record the review details
    addHistory(workItemId, 'agent_output', JSON.stringify(review), 'code-quality-reviewer');
    
    // Update work item status based on review
    if (review.status === 'approved') {
      updateWorkItemStatus(workItemId, 'done', 'code-quality-reviewer');
      console.log(`   ✅ Work approved and marked as done`);
    } else {
      // Send back to in_progress for developer to address issues
      updateWorkItemStatus(workItemId, 'in_progress', 'code-quality-reviewer');
      console.log(`   ⚠️  Work needs changes, sent back to development`);
      
      // Add a decision entry with the required changes
      addHistory(workItemId, 'decision', 
        `Needs changes: ${review.issues.map(i => `[${i.severity}] ${i.description}`).join('; ')}`, 
        'code-quality-reviewer'
      );
    }
    
  } catch (error) {
    console.error('❌ Code quality reviewer agent error:', error);
    addHistory(workItemId, 'agent_output', `Review error: ${error}`, 'code-quality-reviewer');
  } finally {
    // Always release the work item
    releaseWorkItem(workItemId, agentId);
  }
}