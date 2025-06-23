import { WorkItem } from '../types/index.js';
import { getWorkItem, updateWorkItemStatus, createWorkItem, generateId, addHistory, claimWorkItem, releaseWorkItem } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildArchitectPrompt, PromptConfig } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import { parseAgentJsonResponse } from './json-parser.js';
import { ResourceExhaustionSimulator } from './resource-exhaustion-simulator.js';
import { BackoffStrategy } from './backoff-strategy.js';
import { ContextManager } from './context-manager.js';
import logger from '../utils/logger.js';

export interface ArchitectAnalysisResult {
  technicalApproach: string;
  stories: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
    estimatedEffort: 'small' | 'medium' | 'large';
  }>;
  risks: string[];
  dependencies: string[];
}

export async function runArchitectAgent(workItemId: string, config: OrchestratorConfig): Promise<void> {
  const agentId = `architect-${Date.now()}`;
  console.log(`\n🏗️  Architect Agent: Analyzing epic ${workItemId}...`);
  
  // Initialize resource exhaustion simulator if configured
  let resourceSimulator: ResourceExhaustionSimulator | undefined;
  if (config.resourceExhaustion) {
    resourceSimulator = new ResourceExhaustionSimulator(config.resourceExhaustion);
    console.log('🔬 Resource exhaustion simulation enabled');
  }
  
  // Initialize backoff strategy
  const backoffStrategy = new BackoffStrategy({
    initialDelayMs: 2000,
    maxDelayMs: 120000,
    multiplier: 2,
    maxRetries: 5,
    jitterMs: 500
  });
  
  try {
    // Try to claim the work item
    if (!claimWorkItem(workItemId, agentId)) {
      console.log('⚠️  Work item is already being processed by another agent');
      return;
    }

    // Get the epic details
    const epic = getWorkItem(workItemId);
    if (!epic || epic.type !== 'epic') {
      console.error('❌ Work item not found or not an epic');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    console.log(`   📄 Epic: "${epic.title}"`);
    console.log(`   📝 Description: ${epic.description?.substring(0, 100) || 'No description'}...`);

    // Update status to in_progress
    updateWorkItemStatus(workItemId, 'in_progress', 'architect');
    
    // Build and execute prompt
    const contextManager = new ContextManager({
      maxHistoryItems: 10,
      maxRelatedItems: 5,
      lookbackHours: config.contextLookbackHours || 168,
      enableCaching: true,
      cacheTTLMinutes: config.contextCacheTTLMinutes || 15
    });
    
    const promptConfig: PromptConfig = {
      enableHistoricalContext: config.enableHistoricalContext !== false,
      maxContextLength: config.maxContextLength || 2000,
      contextManager
    };
    
    const prompt = await buildArchitectPrompt(epic, promptConfig);
    const result = await executeClaudeAgent('architect', prompt, config, config.maxBufferMB);
    
    if (!result.success) {
      console.error('❌ Architect agent failed:', result.error);
      addHistory(workItemId, 'agent_output', `Architect analysis failed: ${result.error}`, 'architect');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Parse analysis result
    const parseResult = parseAgentJsonResponse<ArchitectAnalysisResult>(result.output, 'architect');
    
    if (!parseResult.success) {
      console.error('❌ Failed to parse architect analysis:', parseResult.error);
      console.log('Raw output:', parseResult.rawOutput);
      
      // Record detailed error for self-healing
      const errorDetails = {
        errorType: 'JSON_PARSE_ERROR',
        errorMessage: parseResult.error || 'Unknown parsing error',
        agentType: 'architect',
        expectedFormat: 'ArchitectAnalysisResult JSON',
        rawOutput: parseResult.rawOutput,
        workItemId: workItemId,
        epicTitle: epic.title,
        timestamp: new Date().toISOString()
      };
      
      addHistory(workItemId, 'error', JSON.stringify(errorDetails), 'architect');
      addHistory(workItemId, 'agent_output', 'Failed to parse architect analysis - error recorded for investigation', 'architect');
      
      // Update status back to backlog so manager can handle
      updateWorkItemStatus(workItemId, 'backlog', 'architect');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    const analysis = parseResult.data!;
    
    // Validate the parsed object has expected structure
    if (!analysis.technicalApproach || !Array.isArray(analysis.stories)) {
      console.error('❌ Invalid JSON structure: missing required fields');
      
      const errorDetails = {
        errorType: 'JSON_STRUCTURE_ERROR',
        errorMessage: 'Invalid JSON structure: missing required fields',
        agentType: 'architect',
        expectedFormat: 'ArchitectAnalysisResult with technicalApproach and stories array',
        rawOutput: parseResult.rawOutput,
        parsedData: JSON.stringify(analysis),
        workItemId: workItemId,
        epicTitle: epic.title,
        timestamp: new Date().toISOString()
      };
      
      addHistory(workItemId, 'error', JSON.stringify(errorDetails), 'architect');
      addHistory(workItemId, 'agent_output', 'Invalid architect analysis structure - error recorded for investigation', 'architect');
      updateWorkItemStatus(workItemId, 'backlog', 'architect');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    console.log('\n📋 Architect Analysis Complete:');
    console.log(`   Technical Approach: ${analysis.technicalApproach}`);
    console.log(`   Stories to create: ${analysis.stories.length}`);
    console.log(`   Risks identified: ${analysis.risks.length}`);
    
    // Record the technical approach
    addHistory(workItemId, 'agent_output', JSON.stringify({
      technicalApproach: analysis.technicalApproach,
      risks: analysis.risks,
      dependencies: analysis.dependencies
    }), 'architect');
    
    // Create user stories
    console.log(`\n📦 Creating ${analysis.stories.length} user stories...`);
    for (let i = 0; i < analysis.stories.length; i++) {
      const story = analysis.stories[i];
      const storyId = generateId('STORY');
      createWorkItem(
        storyId,
        'story',
        story.title,
        `${story.description}\n\n**Acceptance Criteria:**\n${story.acceptanceCriteria.map(ac => `- ${ac}`).join('\n')}\n\n**Estimated Effort:** ${story.estimatedEffort}`,
        workItemId,
        'ready'
      );
      console.log(`   ✅ Created story: ${storyId} - ${story.title}`);
      addHistory(storyId, 'decision', 'Created by architect agent', 'architect');
    }
    
    // Mark epic as ready (stories created)
    updateWorkItemStatus(workItemId, 'ready', 'architect');
    console.log(`   ✅ Epic analysis complete and stories created`);
    
  } catch (error) {
    console.error('❌ Architect agent error:', error);
    addHistory(workItemId, 'agent_output', `Architect error: ${error}`, 'architect');
  } finally {
    // Always release the work item
    releaseWorkItem(workItemId, agentId);
  }
}