import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface ArchitectTask {
  description: string;
  requirements?: string[];
  context?: string;
  scope?: string;
}

export interface ArchitectResult {
  success: boolean;
  output: string;
  error?: string;
}

export function loadInstructions(): string {
  const projectRoot = process.cwd();
  
  // Load role-specific instructions
  const architectRole = readFileSync(
    join(projectRoot, 'dev-roles', 'ROLE_ARCHITECT.md'),
    'utf8'
  );
  
  // Load project structure for context
  const projectStructure = readFileSync(
    join(projectRoot, 'docs', 'project-structure.md'),
    'utf8'
  );
  
  // Combine instructions
  return `${architectRole}\n\n## Project Structure Context\n\n${projectStructure}`;
}

export function buildPrompt(task: ArchitectTask): string {
  const instructions = loadInstructions();
  
  let prompt = `${instructions}\n\n## Current Task\n\n${task.description}`;
  
  if (task.requirements && task.requirements.length > 0) {
    prompt += `\n\n## Requirements\n\n${task.requirements.map(req => `- ${req}`).join('\n')}`;
  }
  
  if (task.scope) {
    prompt += `\n\n## Scope\n\n${task.scope}`;
  }
  
  if (task.context) {
    prompt += `\n\n## Additional Context\n\n${task.context}`;
  }
  
  return prompt;
}

export async function executeTask(task: ArchitectTask): Promise<ArchitectResult> {
  try {
    const prompt = buildPrompt(task);
    
    // Execute claude with the constructed prompt
    const result = execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      timeout: 300000, // 5 minutes
      stdio: 'pipe'
    });
    
    return {
      success: true,
      output: result.trim()
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message
    };
  }
}

