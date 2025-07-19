import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface ReviewerTask {
  description: string;
  requirements?: string[];
  context?: string;
  reviewType?: string;
  branchName?: string;
  userStoryId?: number;
  developmentTaskId?: number;
  testingTaskId?: number;
}

export interface ReviewerResult {
  success: boolean;
  output: string;
  error?: string;
  approved?: boolean;
  feedback?: string;
  changesRequired?: boolean;
}

export function loadInstructions(): string {
  const projectRoot = process.cwd();
  
  // Load role-specific instructions
  const reviewerRole = readFileSync(
    join(projectRoot, 'dev-roles', 'ROLE_REVIEWER.md'),
    'utf8'
  );
  
  // Load project structure for context
  const projectStructure = readFileSync(
    join(projectRoot, 'docs', 'project-structure.md'),
    'utf8'
  );
  
  // Combine instructions
  return `${reviewerRole}\n\n## Project Structure Context\n\n${projectStructure}`;
}

export function buildPrompt(task: ReviewerTask): string {
  const instructions = loadInstructions();
  
  let prompt = `${instructions}\n\n## Current Task\n\n${task.description}`;
  
  if (task.branchName) {
    prompt += `\n\n## Branch Information\n\nBranch: ${task.branchName}\nWorktree Path: ./worktrees/${task.branchName}/`;
  }
  
  if (task.reviewType) {
    prompt += `\n\n## Review Type\n\n${task.reviewType}`;
  }
  
  if (task.requirements && task.requirements.length > 0) {
    prompt += `\n\n## Requirements to Verify\n\n${task.requirements.map(req => `- ${req}`).join('\n')}`;
  }
  
  if (task.context) {
    prompt += `\n\n## Additional Context\n\n${task.context}`;
  }
  
  // Add specific review outcome instructions
  prompt += `\n\n## Review Outcome Instructions

Please complete your code review and provide a clear outcome:

1. **If the code is APPROVED:**
   - State "REVIEW OUTCOME: APPROVED" at the end of your response
   - Provide a summary of what was reviewed
   - Highlight any particularly good practices you found
   - The user story can be marked as done

2. **If CHANGES ARE REQUIRED:**
   - State "REVIEW OUTCOME: CHANGES REQUIRED" at the end of your response
   - Provide specific, actionable feedback
   - List the issues that must be addressed before approval
   - A new development task will be created with your feedback

Your review should follow the structured approach in your role guide, covering:
- Code quality and functionality
- Architecture and design
- Testing coverage and quality
- Documentation and standards
- Acceptance criteria verification`;
  
  return prompt;
}

export async function executeTask(task: ReviewerTask): Promise<ReviewerResult> {
  try {
    const prompt = buildPrompt(task);
    
    // Execute claude with the constructed prompt
    const result = execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      timeout: 600000, // 10 minutes for thorough review
      stdio: 'pipe'
    });
    
    const output = result.trim();
    
    // Parse the outcome from the response
    const approved = output.includes('REVIEW OUTCOME: APPROVED');
    const changesRequired = output.includes('REVIEW OUTCOME: CHANGES REQUIRED');
    
    // Extract feedback (everything before the outcome statement)
    let feedback = output;
    if (approved) {
      feedback = output.split('REVIEW OUTCOME: APPROVED')[0].trim();
    } else if (changesRequired) {
      feedback = output.split('REVIEW OUTCOME: CHANGES REQUIRED')[0].trim();
    }
    
    return {
      success: true,
      output,
      approved,
      changesRequired,
      feedback
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
      approved: false,
      changesRequired: false
    };
  }
}