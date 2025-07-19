/**
 * Testing Task Processor - Functional DI Pattern
 * 
 * Processes testing tasks using dependency injection for test execution.
 * Uses factory functions and higher-order functions for clean functional DI.
 */
import { join } from 'path';
import Database from 'better-sqlite3';
import { getCurrentBranch } from '../../lib/git-utils.ts';
import { createTaskService } from '../services/task-service.ts';
import { 
  type TestExecutor, 
  createDefaultTestExecutor 
} from './test-executors.ts';

export interface ProcessResult {
  success: boolean;
  summary?: string;
  error?: string;
}

/**
 * Process a testing task using dependency injection for test execution
 */
export async function processTestingTask(
  taskId: number, 
  db: Database.Database,
  testExecutor: TestExecutor = createDefaultTestExecutor()
): Promise<ProcessResult> {
  try {
    // Get task details
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    // Use task's branch_name or fallback to current git branch
    const branchName = task.branch_name || getCurrentBranch();
    
    // Execute tests using injected executor
    const worktreePath = join(process.cwd(), 'worktrees', branchName);
    console.log(`Running tests in worktree: ${worktreePath}`);
    
    const testResult = await testExecutor(worktreePath);
    
    // Create summary based on test result
    const newProgress = testResult.passed 
      ? `All tests passed successfully!\n\nTest Output:\n${testResult.output}`
      : `Tests failed.\n\nTest Output:\n${testResult.output}${testResult.errorOutput ? `\n\nError:\n${testResult.errorOutput}` : ''}`;
    
    // Preserve previous summary if exists
    const previousSummary = task.summary;
    let summary = newProgress;
    
    if (previousSummary && previousSummary.trim()) {
      summary = `${previousSummary}\n\n--- Latest Progress ---\n\n${newProgress}`;
    }
    
    // Update task status
    db.prepare(`
      UPDATE tasks 
      SET status = 'done', summary = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(summary, taskId);
    
    // Create follow-up task
    const taskService = createTaskService(db);
    
    if (testResult.passed) {
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
        const bugSummary = `Fix failing tests:\n\nThe recent changes have broken the tests. Please review the test failures below and fix the issues.\n\n${testResult.errorOutput || testResult.output}`;
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