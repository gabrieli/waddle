import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface TesterTask {
  description: string;
  requirements?: string[];
  context?: string;
  testScope?: string;
  platforms?: string[];
}

export interface TesterResult {
  success: boolean;
  output: string;
  error?: string;
}

export function loadInstructions(): string {
  const projectRoot = process.cwd();
  
  // Load role-specific instructions
  const testerRole = readFileSync(
    join(projectRoot, 'dev-roles', 'ROLE_TESTER.md'),
    'utf8'
  );
  
  // Load project structure for context
  const projectStructure = readFileSync(
    join(projectRoot, 'docs', 'project-structure.md'),
    'utf8'
  );
  
  // Combine instructions
  return `${testerRole}\n\n## Project Structure Context\n\n${projectStructure}`;
}

export function buildPrompt(task: TesterTask): string {
  const instructions = loadInstructions();
  
  let prompt = `${instructions}\n\n## Current Task\n\n${task.description}`;
  
  if (task.requirements && task.requirements.length > 0) {
    prompt += `\n\n## Requirements\n\n${task.requirements.map(req => `- ${req}`).join('\n')}`;
  }
  
  if (task.testScope) {
    prompt += `\n\n## Test Scope\n\n${task.testScope}`;
  }
  
  if (task.platforms && task.platforms.length > 0) {
    prompt += `\n\n## Target Platforms\n\n${task.platforms.map(platform => `- ${platform}`).join('\n')}`;
  }
  
  if (task.context) {
    prompt += `\n\n## Additional Context\n\n${task.context}`;
  }
  
  return prompt;
}

export async function executeTask(task: TesterTask): Promise<TesterResult> {
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

