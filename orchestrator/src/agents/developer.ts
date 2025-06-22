import { WorkItem } from '../types/index.js';
import { getWorkItem, updateWorkItemStatus, addHistory, claimWorkItem, releaseWorkItem, getWorkItemHistory, getBugMetadata } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildDeveloperPrompt } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { parseAgentJsonResponse } from './json-parser.js';

export interface DeveloperImplementationResult {
  status: 'completed' | 'blocked' | 'in_progress';
  implementationNotes: string;
  filesChanged: string[];
  testsAdded: boolean;
  temporaryArtifactsRemoved?: string[];
  blockers?: string[];
}

export async function runDeveloperAgent(workItemId: string, config: OrchestratorConfig): Promise<void> {
  const agentId = `developer-${Date.now()}`;
  console.log(`\n💻 Developer Agent: Implementing ${workItemId}...`);
  
  try {
    // Try to claim the work item
    if (!claimWorkItem(workItemId, agentId)) {
      console.log('⚠️  Work item is already being processed by another agent');
      return;
    }

    // Get the work item details
    const workItem = getWorkItem(workItemId);
    if (!workItem || (workItem.type !== 'story' && workItem.type !== 'bug')) {
      console.error('❌ Work item not found or not a story/bug');
      releaseWorkItem(workItemId, agentId);
      return;
    }

    // Update status to in_progress
    updateWorkItemStatus(workItemId, 'in_progress', 'developer');
    
    // Get technical context based on work item type
    let technicalContext = 'No technical context available';
    
    if (workItem.type === 'bug') {
      // For bugs, get the bug analysis from Bug Buster
      const { getBugMetadata } = await import('../database/utils.js');
      const bugMetadata = getBugMetadata(workItemId);
      
      if (bugMetadata) {
        const reproSteps = JSON.parse(bugMetadata.reproduction_steps || '[]');
        const tempArtifacts = JSON.parse(bugMetadata.temporary_artifacts || '[]');
        
        technicalContext = `Bug Analysis:
Root Cause: ${bugMetadata.root_cause}
Suggested Fix: ${bugMetadata.suggested_fix || 'None provided'}
Reproduction Test:
${bugMetadata.reproduction_test}
Temporary Artifacts to Clean: ${tempArtifacts.join(', ')}

IMPORTANT: You must ensure all temporary artifacts are removed before marking as complete.`;
      }
    } else if (workItem.parent_id) {
      // For stories, get architect analysis from parent epic
      const epicHistory = getWorkItemHistory(workItem.parent_id);
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
    const prompt = buildDeveloperPrompt(workItem, technicalContext);
    const result = await executeClaudeAgent('developer', prompt, config);
    
    if (!result.success) {
      console.error('❌ Developer agent failed:', result.error);
      addHistory(workItemId, 'agent_output', `Development failed: ${result.error}`, 'developer');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Parse implementation result
    const parseResult = parseAgentJsonResponse<DeveloperImplementationResult>(result.output, 'developer');
    
    if (!parseResult.success) {
      console.error('❌ Failed to parse developer implementation:', parseResult.error);
      console.log('Raw output:', parseResult.rawOutput);
      
      // Record detailed error for self-healing
      const errorDetails = {
        errorType: 'JSON_PARSE_ERROR',
        errorMessage: parseResult.error || 'Unknown parsing error',
        agentType: 'developer',
        expectedFormat: 'DeveloperImplementationResult JSON',
        rawOutput: parseResult.rawOutput,
        workItemId: workItemId,
        workItemTitle: workItem.title,
        timestamp: new Date().toISOString()
      };
      
      addHistory(workItemId, 'error', JSON.stringify(errorDetails), 'developer');
      addHistory(workItemId, 'agent_output', 'Failed to parse implementation result - error recorded for investigation', 'developer');
      
      // Update status back to ready so it can be retried
      updateWorkItemStatus(workItemId, 'ready', 'developer');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    const implementation = parseResult.data!;
    
    console.log('\n📋 Development Result:');
    console.log(`   Status: ${implementation.status}`);
    console.log(`   Files changed: ${implementation.filesChanged.length}`);
    console.log(`   Tests added: ${implementation.testsAdded ? 'Yes' : 'No'}`);
    
    if (workItem.type === 'bug' && implementation.temporaryArtifactsRemoved) {
      console.log(`   Temporary artifacts cleaned: ${implementation.temporaryArtifactsRemoved.length}`);
    }
    
    // Record the implementation details
    addHistory(workItemId, 'agent_output', JSON.stringify(implementation), 'developer');
    
    // Update work item status based on implementation result
    switch (implementation.status) {
      case 'completed':
        updateWorkItemStatus(workItemId, 'review', 'developer');
        console.log(`   ✅ ${workItem.type} implementation complete, moved to review`);
        break;
      case 'blocked':
        console.log(`   ⚠️  ${workItem.type} blocked: ${implementation.blockers?.join(', ')}`);
        addHistory(workItemId, 'decision', `Blocked: ${implementation.blockers?.join(', ')}`, 'developer');
        break;
      case 'in_progress':
        console.log(`   ⏳ ${workItem.type} still in progress`);
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