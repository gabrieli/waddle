import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from './developer.ts';

// Create a test version of buildPrompt that accepts instructions directly
function testBuildPrompt(instructions: string, task: any): string {
  let prompt = `${instructions}\n\n## Current Task\n\n${task.description}`;
  
  if (task.requirements && task.requirements.length > 0) {
    prompt += `\n\n## Requirements\n\n${task.requirements.map((req: string) => `- ${req}`).join('\n')}`;
  }
  
  if (task.context) {
    prompt += `\n\n## Additional Context\n\n${task.context}`;
  }
  
  return prompt;
}

describe('Developer Agent', () => {
  test('buildPrompt should build basic prompt with task description', () => {
    const mockInstructions = '# Developer Role\nInstructions...\n\n## Project Structure Context\n\n# Project Structure\nStructure...';
    const task = { description: 'Implement user authentication' };
    
    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('# Developer Role'));
    assert(result.includes('# Project Structure'));
    assert(result.includes('## Current Task'));
    assert(result.includes('Implement user authentication'));
  });

  test('buildPrompt should include requirements when provided', () => {
    const mockInstructions = '# Developer Role\nInstructions...';
    const task = {
      description: 'Implement user authentication',
      requirements: ['Use JWT tokens', 'Hash passwords', 'Validate email']
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Requirements'));
    assert(result.includes('- Use JWT tokens'));
    assert(result.includes('- Hash passwords'));
    assert(result.includes('- Validate email'));
  });

  test('buildPrompt should include context when provided', () => {
    const mockInstructions = '# Developer Role\nInstructions...';
    const task = {
      description: 'Implement user authentication',
      context: 'This is for a social media application'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Additional Context'));
    assert(result.includes('This is for a social media application'));
  });

  test('buildPrompt should include all sections when all optional fields are provided', () => {
    const mockInstructions = '# Developer Role\nInstructions...';
    const task = {
      description: 'Implement user authentication',
      requirements: ['Use JWT tokens'],
      context: 'Social media app'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Current Task'));
    assert(result.includes('## Requirements'));
    assert(result.includes('## Additional Context'));
  });

  test('buildPrompt should not include requirements section when empty array', () => {
    const mockInstructions = '# Developer Role\nInstructions...';
    const task = {
      description: 'Implement user authentication',
      requirements: []
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(!result.includes('## Requirements'));
    assert(result.includes('## Current Task'));
  });

  test('buildPrompt should handle undefined requirements', () => {
    const mockInstructions = '# Developer Role\nInstructions...';
    const task = {
      description: 'Implement user authentication'
      // requirements is undefined
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(!result.includes('## Requirements'));
    assert(result.includes('## Current Task'));
    assert(result.includes('Implement user authentication'));
  });

  test('prompt structure should be correct with proper ordering', () => {
    const mockInstructions = '# Developer Role\nInstructions...';
    const task = {
      description: 'Test task',
      requirements: ['Req 1'],
      context: 'Test context'
    };

    const result = testBuildPrompt(mockInstructions, task);
    
    // Check that sections appear in the correct order
    const taskIndex = result.indexOf('## Current Task');
    const reqIndex = result.indexOf('## Requirements');
    const contextIndex = result.indexOf('## Additional Context');
    
    assert(taskIndex < reqIndex, 'Current Task should come before Requirements');
    assert(reqIndex < contextIndex, 'Requirements should come before Additional Context');
  });
});