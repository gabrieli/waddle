/**
 * Testing Task Processor
 * 
 * Processes testing tasks by executing npm run test:all in the appropriate worktree
 * and creating follow-up tasks based on test results
 */
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
 * Process a testing task by running npm run test:all
 */
export async function processTestingTask(
  taskId: number, 
  db: Database.Database
): Promise<ProcessResult> {
  try {
    // Get task details
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    if (!task.branch_name) {
      return { success: false, error: 'Task has no branch_name specified' };
    }
    
    // Run npm run test:all in the worktree
    const worktreePath = join(process.cwd(), 'worktrees', task.branch_name);
    console.log(`Running tests in worktree: ${worktreePath}`);
    
    let testsPassed = false;
    let output = '';
    let errorOutput = '';
    
    try {
      const { stdout, stderr } = await execAsync('npm run test:all', {
        cwd: worktreePath,
        env: { ...process.env }
      });
      testsPassed = true;
      output = stdout;
      if (stderr) {
        output += `\n\nWarnings:\n${stderr}`;
      }
    } catch (error) {
      testsPassed = false;
      output = error.stdout || '';
      errorOutput = error.stderr || error.message;
    }
    
    // Create summary
    const summary = testsPassed 
      ? `All tests passed successfully!\n\nTest Output:\n${output}`
      : `Tests failed.\n\nTest Output:\n${output}\n\nError:\n${errorOutput}`;
    
    // Update task status
    db.prepare(`
      UPDATE tasks 
      SET status = 'done', summary = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(summary, taskId);
    
    // Create follow-up task
    const taskService = createTaskService(db);
    
    if (testsPassed) {
      // Tests passed - create review task
      await taskService.createTask({
        type: 'review',
        work_item_id: task.user_story_id,
        branch_name: task.branch_name
      });
      console.log('Tests passed - created review task');
    } else {
      // Tests failed - create development task
      const result = await taskService.createTask({
        type: 'development',
        work_item_id: task.user_story_id,
        branch_name: task.branch_name
      });
      
      // Add bug details to the development task
      if (result.success) {
        const bugSummary = `Fix failing tests:\n\nThe recent changes have broken the tests. Please review the test failures below and fix the issues.\n\n${errorOutput || output}`;
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