/**
 * Review Task Processor
 * 
 * Processes review tasks by executing code review through the reviewer agent
 * and creating follow-up tasks based on review results
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { executeClaude } from '../clients/claude.ts';
import { createTaskService } from '../services/task-service.ts';

export interface ProcessResult {
  success: boolean;
  summary?: string;
  error?: string;
}

export interface ClaudeClient {
  executeClaude(prompt: string, options?: any): Promise<any>;
}

// Default Claude client for production use
const defaultClaudeClient: ClaudeClient = {
  executeClaude
};

/**
 * Load reviewer instructions from various sources
 */
function loadInstructions(): string {
  const projectRoot = process.cwd();
  
  try {
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
  } catch (error) {
    // Return basic instructions if files are missing
    return `# Code Reviewer Role\n\nYou are a skilled code reviewer working on this project.\n\n## Instructions\n\nReview the assigned code changes for quality, correctness, and adherence to standards.`;
  }
}

/**
 * Build review-specific prompt
 */
function buildReviewPrompt(task: any, workItem: any): string {
  let prompt = `## Current Task\n\n${task.type}: Code Review for ${workItem.name}`;
  
  if (workItem.description) {
    prompt += `\n\n## User Story Description\n\n${workItem.description}`;
  }
  
  if (task.summary) {
    prompt += `\n\n## Previous Progress\n\n${task.summary}`;
  }
  
  if (task.branch_name) {
    prompt += `\n\n## Branch Information\n\nBranch: ${task.branch_name}\nWorktree Path: ./worktrees/${task.branch_name}/`;
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

/**
 * Process a review task
 */
export async function processReviewTask(
  taskId: number, 
  db: Database.Database,
  claudeClient: ClaudeClient = defaultClaudeClient
): Promise<ProcessResult> {
  try {
    // Get task and work item details
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    const workItem = db.prepare('SELECT * FROM work_items WHERE id = ?').get(task.user_story_id);
    if (!workItem) {
      return { success: false, error: 'Work item not found' };
    }
    
    // Build review prompt and context separately
    const taskPrompt = buildReviewPrompt(task, workItem);
    const systemPrompt = loadInstructions();
    
    // Execute Claude with system prompt for context and task prompt for specific work
    const result = await claudeClient.executeClaude(taskPrompt, { 
      verbose: true, 
      timeout: 600000, // 10 minutes for thorough review
      systemPrompt
    }) as any;
    
    if (!result.success) {
      return { 
        success: false, 
        error: result.error || 'Claude execution failed'
      };
    }
    
    // Parse the review outcome
    const output = result.output;
    const approved = output.includes('REVIEW OUTCOME: APPROVED');
    const changesRequired = output.includes('REVIEW OUTCOME: CHANGES REQUIRED');
    
    // Extract feedback (everything before the outcome statement)
    let feedback = output;
    if (approved) {
      feedback = output.split('REVIEW OUTCOME: APPROVED')[0].trim();
    } else if (changesRequired) {
      feedback = output.split('REVIEW OUTCOME: CHANGES REQUIRED')[0].trim();
    }
    
    // Update task status and summary (preserve previous summary if exists)
    const previousSummary = task.summary;
    let newSummary = output;
    
    if (previousSummary && previousSummary.trim()) {
      newSummary = `${previousSummary}\n\n--- Latest Progress ---\n\n${output}`;
    }
    
    const updateTask = db.prepare(`
      UPDATE tasks 
      SET status = 'done', summary = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateTask.run(newSummary, taskId);
    
    // Create follow-up based on review outcome
    const taskService = createTaskService(db);
    
    if (approved) {
      // Review approved - mark work item as done
      const updateWorkItem = db.prepare(`
        UPDATE work_items 
        SET status = 'done', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateWorkItem.run(task.user_story_id);
      
      console.log('Code review approved - user story marked as done');
    } else if (changesRequired) {
      // Changes required - create new development task with feedback
      const result = await taskService.createTask({
        type: 'development',
        work_item_id: task.user_story_id,
        branch_name: task.branch_name
      });
      
      // Add review feedback to the development task
      if (result.success) {
        const developmentSummary = `Address code review feedback:\n\n${feedback}\n\nPlease review the feedback above and implement the requested changes. Once complete, the code will be tested again.`;
        db.prepare(`
          UPDATE tasks 
          SET summary = ?
          WHERE id = ?
        `).run(developmentSummary, result.taskId);
      }
      
      console.log('Code review requested changes - created development task with feedback');
    } else {
      // No clear outcome - treat as requiring clarification
      console.log('Review completed but outcome unclear - manual intervention may be needed');
    }
    
    return { 
      success: true, 
      summary: output 
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred'
    };
  }
}