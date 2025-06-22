import { WorkItem } from '../types/index.js';
import { getWorkItem, updateWorkItemStatus, addHistory, claimWorkItem, releaseWorkItem, updateProcessingTimestamp, saveBugMetadata } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildBugBusterPrompt } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { parseAgentJsonResponse } from './json-parser.js';

export interface BugBusterResult {
  status: 'reproduced' | 'cannot_reproduce' | 'blocked';
  reproductionTest: string;
  rootCause: string;
  reproductionSteps: string[];
  temporaryArtifacts: string[];
  suggestedFix?: string;
  blockers?: string[];
}

export async function runBugBusterAgent(workItemId: string, config: OrchestratorConfig): Promise<void> {
  const agentId = `bug-buster-${Date.now()}`;
  console.log(`\n👻 Bug Buster Agent ${agentId}: Investigating bug ${workItemId}...`);
  
  // Claim the work item
  if (!claimWorkItem(workItemId, agentId)) {
    console.log('⏭️  Bug Buster: Work item already being processed by another agent');
    return;
  }
  
  try {
    const bug = getWorkItem(workItemId);
    if (!bug || bug.type !== 'bug') {
      console.error('❌ Bug Buster: Invalid bug work item');
      return;
    }
    
    // Get error history and context
    const { getWorkItemHistory } = await import('../database/utils.js');
    const history = getWorkItemHistory(workItemId);
    const errorHistory = history.filter(h => h.action === 'error').slice(0, 3);
    
    const contextStr = errorHistory.map(h => {
      const error = JSON.parse(h.content || '{}');
      return `Error: ${error.errorType} - ${error.errorMessage}\nAgent: ${error.agentType}\nStack: ${error.stack || 'N/A'}`;
    }).join('\n---\n');
    
    // Build and execute prompt
    const prompt = buildBugBusterPrompt(bug, contextStr);
    const result = await executeClaudeAgent('bug-buster', prompt, config);
    
    // Keep the lock alive during processing
    updateProcessingTimestamp(workItemId, agentId);
    
    if (!result.success) {
      console.error('❌ Bug Buster agent failed:', result.error);
      addHistory(workItemId, 'error', JSON.stringify({
        agentType: 'bug-buster',
        errorType: 'execution_failed',
        errorMessage: result.error,
        timestamp: new Date().toISOString()
      }), agentId);
      return;
    }
    
    // Parse result
    const parseResult = parseAgentJsonResponse<BugBusterResult>(result.output, 'bug-buster');
    
    if (!parseResult.success) {
      console.error('❌ Failed to parse bug buster result:', parseResult.error);
      console.log('Raw output:', parseResult.rawOutput);
      addHistory(workItemId, 'error', JSON.stringify({
        agentType: 'bug-buster',
        errorType: 'JSON_PARSE_ERROR',
        errorMessage: parseResult.error || 'Unknown parsing error',
        rawOutput: parseResult.rawOutput,
        workItemId: workItemId,
        bugTitle: bug.title,
        timestamp: new Date().toISOString()
      }), agentId);
      return;
    }
    
    const bugAnalysis = parseResult.data!;
    
    // Store the analysis results
    const analysisData = {
      reproductionTest: bugAnalysis.reproductionTest,
      rootCause: bugAnalysis.rootCause,
      reproductionSteps: bugAnalysis.reproductionSteps,
      temporaryArtifacts: bugAnalysis.temporaryArtifacts,
      suggestedFix: bugAnalysis.suggestedFix
    };
    
    addHistory(workItemId, 'agent_output', JSON.stringify({
      type: 'bug_analysis',
      data: analysisData
    }), agentId);
    
    // Save bug metadata
    const { saveBugMetadata } = await import('../database/utils.js');
    saveBugMetadata(
      workItemId,
      bugAnalysis.reproductionTest,
      bugAnalysis.rootCause,
      bugAnalysis.reproductionSteps,
      bugAnalysis.temporaryArtifacts,
      bugAnalysis.suggestedFix
    );
    
    // Update status based on result
    if (bugAnalysis.status === 'reproduced') {
      console.log('✅ Bug Buster: Successfully reproduced bug');
      console.log(`   Root cause: ${bugAnalysis.rootCause}`);
      console.log(`   Temporary artifacts to clean: ${bugAnalysis.temporaryArtifacts.join(', ')}`);
      updateWorkItemStatus(workItemId, 'ready', agentId);
    } else if (bugAnalysis.status === 'cannot_reproduce') {
      console.log('⚠️  Bug Buster: Cannot reproduce bug');
      console.log(`   Reason: ${bugAnalysis.blockers?.join(', ')}`);
      // Keep in backlog for manual review
    } else {
      console.log('🚫 Bug Buster: Blocked');
      console.log(`   Blockers: ${bugAnalysis.blockers?.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Bug Buster agent error:', error);
    addHistory(workItemId, 'error', JSON.stringify({
      agentType: 'bug-buster',
      errorType: 'unexpected_error',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }), agentId);
  } finally {
    // Always release the work item
    releaseWorkItem(workItemId, agentId);
  }
}