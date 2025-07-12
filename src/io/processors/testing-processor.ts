/**
 * Testing Task Processor
 * 
 * Processes testing tasks by executing npm run test:all in the appropriate worktree
 * and creating follow-up tasks based on test results
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import Database from 'better-sqlite3';
import { createTaskService } from '../services/task-service.ts';

const execAsync = promisify(exec);

export interface ProcessResult {
  success: boolean;
  summary?: string;
  error?: string;
}

/**
 * Load tester instructions from various sources
 */
function loadInstructions(): string {
  const projectRoot = process.cwd();
  
  try {
    // Load role-specific instructions
    const testerRole = readFileSync(
      join(projectRoot, 'dev-roles', 'ROLE_TESTER.md'),
      'utf8'
    );
    
    return testerRole;
  } catch (error) {
    // Return basic instructions if files are missing
    return `# Tester Role\n\nYou are a skilled tester working on this project.\n\n## Instructions\n\nTest the assigned features thoroughly.`;
  }
}

/**
 * Execute tests in the worktree
 */
async function executeTests(branchName: string): Promise<{ success: boolean; output: string; error?: string }> {
  const worktreePath = join(process.cwd(), 'worktrees', branchName);
  
  try {
    // Execute npm run test:all in the worktree
    const { stdout, stderr } = await execAsync('npm run test:all', {
      cwd: worktreePath,
      env: { ...process.env }
    });
    
    // Check if tests passed (exit code 0)
    return {
      success: true,
      output: stdout + (stderr ? `\n\nWarnings:\n${stderr}` : '')
    };
  } catch (error) {
    // Tests failed
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

/**
 * Process a testing task
 */
export async function processTestingTask(
  taskId: number, 
  db: Database.Database
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
    
    if (!task.branch_name) {
      return { success: false, error: 'Task has no branch_name specified' };
    }
    
    // Execute tests
    console.log(`Executing tests in worktree: ./worktrees/${task.branch_name}/`);
    const testResult = await executeTests(task.branch_name);
    
    // Create summary
    const summary = testResult.success 
      ? `All tests passed successfully!\n\nTest Output:\n${testResult.output}`
      : `Tests failed.\n\nTest Output:\n${testResult.output}\n\nError:\n${testResult.error}`;
    
    // Update task status and summary
    const updateTask = db.prepare(`
      UPDATE tasks 
      SET status = 'done', summary = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateTask.run(summary, taskId);
    
    // Create follow-up task based on test results
    const taskService = createTaskService(db);
    
    if (testResult.success) {
      // Tests passed - create review task
      await taskService.createTask({
        type: 'review',
        work_item_id: task.user_story_id,
        branch_name: task.branch_name
      });
      
      console.log('Tests passed - created review task');
    } else {
      // Tests failed - create development task with bug details
      const bugSummary = `Fix failing tests:\n\nThe recent changes have broken the tests. Please review the test failures below and fix the issues.\n\n${testResult.error || testResult.output}`;
      
      const result = await taskService.createTask({
        type: 'development',
        work_item_id: task.user_story_id,
        branch_name: task.branch_name
      });
      
      // Update the new development task with bug details
      if (result.success) {
        db.prepare(`
          UPDATE tasks 
          SET summary = ?
          WHERE id = ?
        `).run(bugSummary, result.taskId);
      }
      
      console.log('Tests failed - created development task to fix issues');
    }
    
    return { 
      success: true, 
      summary: summary 
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred'
    };
  }
}