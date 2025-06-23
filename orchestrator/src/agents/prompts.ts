import { WorkItem } from '../types/index.js';
import { ContextManager } from './context-manager.js';
import { RelevanceScorer } from './relevance-scorer.js';

export interface PromptConfig {
  enableHistoricalContext: boolean;
  maxContextLength: number;
  contextManager?: ContextManager;
  relevanceScorer?: RelevanceScorer;
}

const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  enableHistoricalContext: true,
  maxContextLength: 2000
};

export const MANAGER_PROMPT = `You are a Development Manager. Analyze these work items and decide next steps.

WORK ITEMS:
{workItems}

RECENT ERRORS:
{recentErrors}

{historicalContext}

PROJECT VISION: Waddle is an autonomous development system where AI agents collaborate as a cohesive team. Core objectives:
- Agent autonomy and distributed processing
- Role-based specialization (Manager, Architect, Developer, Reviewer)
- Scalable parallel work processing
- Quality assurance through multi-stage reviews
- Continuous improvement and learning

EPIC QUALITY VALIDATION:
Before assigning epics to architect, validate they meet these criteria:
- Must contribute to Waddle's autonomous development capabilities
- Must improve system functionality, scalability, or quality
- Must have clear business value for the Waddle platform
- REJECT if title contains "Test", "Demo", "Example", "Simulation" without clear product value
- REJECT if focused purely on testing/debugging rather than product improvement
- REJECT if not aligned with project vision and objectives

RULES:
- Bugs in backlog → assign_bug_buster (to investigate and reproduce)
- Bugs in ready → assign_developer (already investigated)
- Stories in ready → assign_developer
- Stories in review → assign_code_quality_reviewer or mark_complete
- Epics in backlog → VALIDATE FIRST, then assign_architect OR reject_epic
- Epics in in_progress with no child stories → assign_architect (retry analysis)
- Epics with stories in ready/in_progress → move epic to in_progress and skip (focus on stories)
- Epics where all stories are done → mark_complete
- Completed work → mark_complete
- If errors are detected → create bug to fix them

PRIORITY ORDER: Bugs > Stories > Epics

SELF-HEALING: When you see errors, create a BUG to fix them. Include:
- Error type and message
- Which agent failed
- Suggested investigation steps
- Reference to the original work item

Return ONLY valid JSON:
{
  "decisions": [{
    "workItemId": "ID",
    "action": "assign_architect|assign_developer|assign_bug_buster|assign_code_quality_reviewer|mark_complete|reject_epic|wait",
    "reason": "brief reason"
  }],
  "createNewItems": [{
    "type": "bug",
    "title": "Fix [error type] in [agent] agent",
    "description": "Detailed description with error context and debugging steps",
    "parentId": null
  }]
}`;

export const ARCHITECT_PROMPT = `You are a Technical Architect for an autonomous development system. Your role is to break down epics into implementable user stories and create technical designs.

EPIC TO ANALYZE:
{epic}

{historicalContext}

Your responsibilities:
1. Understand the epic's goals and requirements
2. Create a technical approach (brief, focused)
3. Break down into 3-5 user stories with clear acceptance criteria
4. Define implementation order and dependencies
5. Identify technical risks or challenges

Output Format:
{
  "technicalApproach": "Brief technical approach",
  "stories": [
    {
      "title": "As a..., I want..., so that...",
      "description": "Detailed description",
      "acceptanceCriteria": ["criteria1", "criteria2"],
      "estimatedEffort": "small|medium|large"
    }
  ],
  "risks": ["risk1", "risk2"],
  "dependencies": ["dep1", "dep2"]
}`;

export const DEVELOPER_PROMPT = `You are a Developer in an autonomous development system. Your role is to implement user stories and fix bugs based on technical context.

WORK ITEM TO IMPLEMENT:
{workItem}

TECHNICAL CONTEXT:
{technicalContext}

{historicalContext}

Your responsibilities:
1. Implement the work item according to requirements
2. For stories: Follow the technical approach defined by the architect
3. For bugs: 
   - Use the reproduction test to verify the bug
   - Implement the fix based on root cause analysis
   - Add regression tests to prevent recurrence
   - REMOVE ALL TEMPORARY ARTIFACTS listed in the technical context
4. Write clean, tested code
5. Update documentation as needed
6. Report completion status

Output Format:
{
  "status": "completed|blocked|in_progress",
  "implementationNotes": "What was done",
  "filesChanged": ["file1", "file2"],
  "testsAdded": true|false,
  "temporaryArtifactsRemoved": ["artifact1", "artifact2"], // for bugs only
  "blockers": ["blocker1"] // if any
}`;

export const CODE_QUALITY_REVIEWER_PROMPT = `You are a Code Quality Reviewer in an autonomous development system. Your role is to review completed work for quality and correctness.

WORK TO REVIEW:
{workItem}

IMPLEMENTATION DETAILS:
{implementation}

{historicalContext}

Your responsibilities:
1. Verify the implementation meets requirements
2. Check code quality and best practices
3. Ensure tests are adequate
4. Provide constructive feedback
5. Approve or request changes

Review Checklist:
- Does it meet all acceptance criteria?
- Is the code clean and maintainable?
- Are there adequate tests?
- Does it follow project conventions?
- Are there any security concerns?
- For bugs: Are regression tests included?
- For bugs: Were all temporary artifacts removed?

Output Format:
{
  "status": "approved|needs_changes",
  "feedback": "Overall feedback",
  "issues": [
    {
      "severity": "critical|major|minor",
      "description": "Issue description",
      "suggestion": "How to fix"
    }
  ],
  "positives": ["What was done well"]
}`;

export const BUG_BUSTER_PROMPT = `You are a Bug Buster (like Ghost Busters but for bugs!) in an autonomous development system. Your role is to investigate bugs, reproduce them, and create failing tests.

BUG TO INVESTIGATE:
{bug}

ERROR CONTEXT:
{errorContext}

{historicalContext}

Your mission:
1. Analyze the error logs and stack traces
2. Create a minimal test case that reproduces the bug
3. Identify the root cause through systematic investigation
4. Document clear reproduction steps
5. List any temporary files/artifacts created during investigation
6. Suggest a potential fix approach

Investigation Guidelines:
- Write a FAILING test that captures the bug behavior
- The test should be minimal and focused on the issue
- Include edge cases that might be related
- Track ALL temporary files/artifacts you create for cleanup
- If you can't reproduce, explain what's blocking you

Output Format:
{
  "status": "reproduced|cannot_reproduce|blocked",
  "reproductionTest": "// Test code that reproduces the bug",
  "rootCause": "Clear explanation of why the bug occurs",
  "reproductionSteps": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "temporaryArtifacts": [
    "path/to/temp/file1.js",
    "path/to/test/fixture.json"
  ],
  "suggestedFix": "Brief description of how to fix",
  "blockers": ["If cannot reproduce, what's blocking"] // optional
}`;

export async function buildManagerPrompt(
  workItems: WorkItem[], 
  history: string, 
  recentErrors?: string,
  config: PromptConfig = DEFAULT_PROMPT_CONFIG
): Promise<string> {
  const workItemsStr = workItems.map(item => 
    `- ${item.type.toUpperCase()} ${item.id}: "${item.title}" [${item.status}]${item.assigned_role ? ` (assigned: ${item.assigned_role})` : ''}`
  ).join('\n');
  
  let historicalContext = '';
  if (config.enableHistoricalContext && config.contextManager) {
    try {
      historicalContext = await config.contextManager.getContextForAgent('manager');
      if (historicalContext && historicalContext.length > config.maxContextLength) {
        historicalContext = historicalContext.substring(0, config.maxContextLength) + '\n[Context truncated]';
      }
    } catch (error) {
      console.warn('Failed to get historical context for manager:', error);
    }
  }
  
  return MANAGER_PROMPT
    .replace('{workItems}', workItemsStr)
    .replace('{history}', history)
    .replace('{recentErrors}', recentErrors || 'No recent errors')
    .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
}

export async function buildArchitectPrompt(
  epic: WorkItem,
  config: PromptConfig = DEFAULT_PROMPT_CONFIG
): Promise<string> {
  const epicStr = `ID: ${epic.id}
Title: ${epic.title}
Description: ${epic.description || 'No description'}
Status: ${epic.status}`;
  
  let historicalContext = '';
  if (config.enableHistoricalContext && config.contextManager) {
    try {
      historicalContext = await config.contextManager.getContextForAgent('architect', epic.id);
      if (historicalContext && historicalContext.length > config.maxContextLength) {
        historicalContext = historicalContext.substring(0, config.maxContextLength) + '\n[Context truncated]';
      }
    } catch (error) {
      console.warn('Failed to get historical context for architect:', error);
    }
  }
  
  return ARCHITECT_PROMPT
    .replace('{epic}', epicStr)
    .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
}

export async function buildDeveloperPrompt(
  workItem: WorkItem, 
  context: string,
  config: PromptConfig = DEFAULT_PROMPT_CONFIG
): Promise<string> {
  const workItemStr = `ID: ${workItem.id}
Title: ${workItem.title}
Type: ${workItem.type}
Description: ${workItem.description || 'No description'}
Status: ${workItem.status}`;
  
  let historicalContext = '';
  if (config.enableHistoricalContext && config.contextManager) {
    try {
      historicalContext = await config.contextManager.getContextForAgent('developer', workItem.id);
      if (historicalContext && historicalContext.length > config.maxContextLength) {
        historicalContext = historicalContext.substring(0, config.maxContextLength) + '\n[Context truncated]';
      }
    } catch (error) {
      console.warn('Failed to get historical context for developer:', error);
    }
  }
  
  return DEVELOPER_PROMPT
    .replace('{workItem}', workItemStr)
    .replace('{technicalContext}', context)
    .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
}

export async function buildCodeQualityReviewerPrompt(
  workItem: WorkItem, 
  implementation: string,
  config: PromptConfig = DEFAULT_PROMPT_CONFIG
): Promise<string> {
  const itemStr = `ID: ${workItem.id}
Title: ${workItem.title}
Description: ${workItem.description || 'No description'}
Type: ${workItem.type}`;
  
  let historicalContext = '';
  if (config.enableHistoricalContext && config.contextManager) {
    try {
      historicalContext = await config.contextManager.getContextForAgent('reviewer', workItem.id);
      if (historicalContext && historicalContext.length > config.maxContextLength) {
        historicalContext = historicalContext.substring(0, config.maxContextLength) + '\n[Context truncated]';
      }
    } catch (error) {
      console.warn('Failed to get historical context for reviewer:', error);
    }
  }
  
  return CODE_QUALITY_REVIEWER_PROMPT
    .replace('{workItem}', itemStr)
    .replace('{implementation}', implementation)
    .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
}

export async function buildBugBusterPrompt(
  bug: WorkItem, 
  errorContext: string,
  config: PromptConfig = DEFAULT_PROMPT_CONFIG
): Promise<string> {
  const bugStr = `ID: ${bug.id}
Title: ${bug.title}
Description: ${bug.description || 'No description'}
Status: ${bug.status}`;
  
  let historicalContext = '';
  if (config.enableHistoricalContext && config.contextManager) {
    try {
      historicalContext = await config.contextManager.getContextForAgent('bug-buster', bug.id);
      if (historicalContext && historicalContext.length > config.maxContextLength) {
        historicalContext = historicalContext.substring(0, config.maxContextLength) + '\n[Context truncated]';
      }
    } catch (error) {
      console.warn('Failed to get historical context for bug-buster:', error);
    }
  }
  
  return BUG_BUSTER_PROMPT
    .replace('{bug}', bugStr)
    .replace('{errorContext}', errorContext)
    .replace('{historicalContext}', historicalContext ? `\nHISTORICAL CONTEXT:\n${historicalContext}` : '');
}