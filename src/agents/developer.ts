import { BaseAgent } from './base';
import { DatabaseConnection } from '../database/connection';
import { ClaudeExecutor } from '../claude/executor';
import { WaddleConfig } from '../config';
import fs from 'fs';
import path from 'path';

export class DeveloperAgent extends BaseAgent {
  private claudeExecutor: ClaudeExecutor;
  private config: WaddleConfig;

  constructor(db: DatabaseConnection, config: WaddleConfig) {
    super('Developer', 'developer', db);
    this.claudeExecutor = new ClaudeExecutor(config);
    this.config = config;
  }

  async execute(workItemId: string): Promise<void> {
    console.log(`Developer agent ${this.id} starting work on item ${workItemId}`);
    
    // Register the agent with the work item FIRST
    this.registerAgent(workItemId);
    
    // Lock the work item
    if (!this.lockWorkItem(workItemId)) {
      throw new Error(`Failed to lock work item ${workItemId}`);
    }
    
    // Update work item status to in_progress
    this.updateWorkItemStatus(workItemId, 'in_progress', 'developer');
    
    // Add work history AFTER agent is registered
    this.addWorkHistory(workItemId, 'developer_started', { agent_id: this.id });
    
    try {
      // Get work item details
      const workItem = this.getWorkItem(workItemId);
      if (!workItem) {
        throw new Error(`Work item ${workItemId} not found`);
      }
      
      // Read the developer role instructions
      const roleInstructions = this.getRoleInstructions();
      
      // Prepare the prompt with work item details and role instructions
      const prompt = this.buildPrompt(workItem, roleInstructions);
      
      // Execute Claude with the prompt
      console.log(`Executing Claude for work item ${workItemId}`);
      const result = await this.claudeExecutor.execute(prompt, this.config.claude.workingDirectory);
      
      if (!result.success) {
        throw new Error(`Claude execution failed: ${result.error}`);
      }
      
      // Log the result
      this.addWorkHistory(workItemId, 'developer_completed', {
        agent_id: this.id,
        output: result.output,
        execution_time: result.executionTime
      });
      
      // Update work item status to review
      this.updateWorkItemStatus(workItemId, 'review', 'reviewer');
      
      console.log(`Developer agent ${this.id} completed work on item ${workItemId}`);
      
    } catch (error) {
      // Log the error
      this.addWorkHistory(workItemId, 'developer_failed', {
        agent_id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
      
    } finally {
      // Cleanup: unlock work item and clear agent's work item
      this.unlockWorkItem(workItemId);
      this.updateAgentWorkItem(null);
    }
  }

  private getWorkItem(workItemId: string): any {
    const stmt = this.db.getDatabase().prepare(`
      SELECT * FROM work_items WHERE id = ?
    `);
    
    return stmt.get(workItemId);
  }

  private getRoleInstructions(): string {
    try {
      return fs.readFileSync(this.config.agents.developer.roleInstructionsPath, 'utf-8');
    } catch (error) {
      console.warn('Failed to read role instructions, using default');
      return 'You are a developer. Follow TDD principles and implement the requested functionality.';
    }
  }

  private buildPrompt(workItem: any, roleInstructions: string): string {
    return `${roleInstructions}

## Current Task
**Title**: ${workItem.title}
**Type**: ${workItem.type}
**Description**: ${workItem.description || 'No description provided'}

Please implement this ${workItem.type} following the development guidelines and TDD principles outlined in your role instructions.`;
  }
}