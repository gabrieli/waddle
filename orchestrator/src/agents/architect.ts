import { WorkItem } from '../types/index.js';
import { getWorkItem, updateWorkItemStatus, createWorkItem, generateId, addHistory, claimWorkItem, releaseWorkItem } from '../database/utils.js';
import { executeClaudeAgent } from './claude-executor.js';
import { buildArchitectPrompt } from './prompts.js';
import { OrchestratorConfig } from '../orchestrator/config.js';

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
    const prompt = buildArchitectPrompt(epic);
    const result = await executeClaudeAgent('architect', prompt, config);
    
    if (!result.success) {
      console.error('❌ Architect agent failed:', result.error);
      addHistory(workItemId, 'agent_output', `Architect analysis failed: ${result.error}`, 'architect');
      releaseWorkItem(workItemId, agentId);
      return;
    }
    
    // Parse analysis result
    let analysis: ArchitectAnalysisResult;
    try {
      // Extract JSON from the output (Claude might include explanation text)
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('❌ Failed to parse architect analysis:', e);
      console.log('Raw output:', result.output);
      addHistory(workItemId, 'agent_output', 'Failed to parse architect analysis', 'architect');
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