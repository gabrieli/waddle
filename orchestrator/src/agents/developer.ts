import { WorkItem } from '../types/index.js';
import { getWorkItem, updateWorkItemStatus, addHistory, claimWorkItem, releaseWorkItem, getWorkItemHistory } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildDeveloperPrompt } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';

export interface DeveloperImplementationResult {
  status: 'completed' | 'blocked' | 'in_progress';
  implementationNotes: string;
  filesChanged: string[];
  testsAdded: boolean;
  blockers?: string[];
}

export async function runDeveloperAgent(workItemId: string, config: OrchestratorConfig): Promise<void> {
  const agentId = `developer-${Date.now()}`;
  console.log(`\n💻 Developer Agent: Implementing story ${workItemId}...`);
  
  try {
    // Try to claim the work item
    if (!claimWorkItem(workItemId, agentId)) {
      console.log('⚠️  Work item is already being processed by another agent');
      return;
    }

    // Get the story details
    const story = getWorkItem(workItemId);
    if (!story || story.type !== 'story') {
      console.error('❌ Work item not found or not a story');
      releaseWorkItem(workItemId, agentId);
      return;
    }

    // Update status to in_progress
    updateWorkItemStatus(workItemId, 'in_progress', 'developer');
    
    // Get technical context from parent epic's architect analysis
    let technicalContext = 'No technical context available';
    if (story.parent_id) {
      const epicHistory = getWorkItemHistory(story.parent_id);
      const architectOutput = epicHistory.find(h => 
        h.action === 'agent_output' && h.created_by === 'architect'
      );
      if (architectOutput && architectOutput.content) {
        try {
          const analysis = JSON.parse(architectOutput.content);
          technicalContext = `Technical Approach: ${analysis.technicalApproach}\nDependencies: ${analysis.dependencies?.join(', ') || 'None'}`;
        } catch (e) {
          // If parsing fails, use the raw content
          technicalContext = architectOutput.content;
        }
      }
    }
    
    // Build and execute prompt
    const prompt = buildDeveloperPrompt(story, technicalContext);
    const result = await executeClaudeAgent('developer', prompt, config);
    
    if (!result.success) {
      console.error('❌ Developer agent failed:', result.error);
      addHistory(workItemId, 'agent_output', `Development failed: ${result.error}`, 'developer');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Parse implementation result
    let implementation: DeveloperImplementationResult;
    try {
      // Extract JSON from the output (Claude might include explanation text)
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      implementation = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('❌ Failed to parse developer implementation:', e);
      console.log('Raw output:', result.output);
      addHistory(workItemId, 'agent_output', 'Failed to parse implementation result', 'developer');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    console.log('\n📋 Development Result:');
    console.log(`   Status: ${implementation.status}`);
    console.log(`   Files changed: ${implementation.filesChanged.length}`);
    console.log(`   Tests added: ${implementation.testsAdded ? 'Yes' : 'No'}`);
    
    // Record the implementation details
    addHistory(workItemId, 'agent_output', JSON.stringify(implementation), 'developer');
    
    // Update story status based on implementation result
    switch (implementation.status) {
      case 'completed':
        updateWorkItemStatus(workItemId, 'review', 'developer');
        console.log(`   ✅ Story implementation complete, moved to review`);
        break;
      case 'blocked':
        console.log(`   ⚠️  Story blocked: ${implementation.blockers?.join(', ')}`);
        addHistory(workItemId, 'decision', `Blocked: ${implementation.blockers?.join(', ')}`, 'developer');
        break;
      case 'in_progress':
        console.log(`   ⏳ Story still in progress`);
        break;
    }
    
  } catch (error) {
    console.error('❌ Developer agent error:', error);
    addHistory(workItemId, 'agent_output', `Developer error: ${error}`, 'developer');
  } finally {
    // Always release the work item
    releaseWorkItem(workItemId, agentId);
  }
}