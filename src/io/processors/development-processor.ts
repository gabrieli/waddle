/**
 * Development Task Processor
 * 
 * Processes development tasks by building prompts from various sources
 * and executing them through Claude agent
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
 * Load developer instructions from various sources
 */
function loadInstructions(): string {
  const projectRoot = process.cwd();
  
  try {
    // Load role-specific instructions
    const developerRole = readFileSync(
      join(projectRoot, 'dev-roles', 'ROLE_DEVELOPER.md'),
      'utf8'
    );
    
    // Load project structure for context
    const projectStructure = readFileSync(
      join(projectRoot, 'docs', 'project-structure.md'),
      'utf8'
    );
    
    // Combine instructions
    return `${developerRole}\n\n## Project Structure Context\n\n${projectStructure}`;
  } catch (error) {
    // Return basic instructions if files are missing
    return `# Developer Role\n\nYou are a skilled developer working on this project.\n\n## Instructions\n\nComplete the assigned task with high quality code.`;
  }
}

/**
 * Build task-specific prompt without context
 */
function buildTaskPrompt(task: any, workItem: any): string {
  let prompt = `## Current Task\n\n${task.type}: ${workItem.name}`;
  
  if (workItem.description) {
    prompt += `\n\n## Description\n\n${workItem.description}`;
  }
  
  if (task.summary) {
    prompt += `\n\n## Previous Progress\n\n${task.summary}`;
  }
  
  if (task.branch_name) {
    prompt += `\n\n## Branch\n\nWork on branch: ${task.branch_name}`;
  }
  
  return prompt;
}

/**
 * Process a development task
 */
export async function processDevelopmentTask(
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
    
    // Build task prompt and context separately
    const taskPrompt = buildTaskPrompt(task, workItem);
    const systemPrompt = loadInstructions();
    
    // Execute Claude with system prompt for context and task prompt for specific work
    const result = await claudeClient.executeClaude(taskPrompt, { 
      verbose: true, 
      timeout: 300000, // 5 minutes
      systemPrompt
    }) as any;
    
    if (!result.success) {
      return { 
        success: false, 
        error: result.error || 'Claude execution failed'
      };
    }
    
    // Update task status and summary
    const updateTask = db.prepare(`
      UPDATE tasks 
      SET status = 'done', summary = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateTask.run(result.output, taskId);
    
    // Update work item status to in_progress
    const updateWorkItem = db.prepare(`
      UPDATE work_items 
      SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateWorkItem.run(task.user_story_id);
    
    // Create testing task
    const taskService = createTaskService(db);
    await taskService.createTask({
      type: 'testing',
      work_item_id: task.user_story_id,
      branch_name: task.branch_name
    });
    
    return { 
      success: true, 
      summary: result.output 
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred'
    };
  }
}