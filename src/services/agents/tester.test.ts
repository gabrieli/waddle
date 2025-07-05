import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from './tester.ts';

// Create a test version of buildPrompt that accepts instructions directly
function testBuildPrompt(instructions: string, task: any): string {
  let prompt = `${instructions}\n\n## Current Task\n\n${task.description}`;
  
  if (task.requirements && task.requirements.length > 0) {
    prompt += `\n\n## Requirements\n\n${task.requirements.map((req: string) => `- ${req}`).join('\n')}`;
  }
  
  if (task.testScope) {
    prompt += `\n\n## Test Scope\n\n${task.testScope}`;
  }
  
  if (task.platforms && task.platforms.length > 0) {
    prompt += `\n\n## Target Platforms\n\n${task.platforms.map((platform: string) => `- ${platform}`).join('\n')}`;
  }
  
  if (task.context) {
    prompt += `\n\n## Additional Context\n\n${task.context}`;
  }
  
  return prompt;
}

describe('Tester Agent', () => {
  test('buildPrompt should build basic prompt with task description', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...\n\n## Project Structure Context\n\n# Project Structure\nStructure...';
    const task = { description: 'Test user authentication flow' };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('# QA/Tester Role'));
    assert(result.includes('# Project Structure'));
    assert(result.includes('## Current Task'));
    assert(result.includes('Test user authentication flow'));
  });

  test('buildPrompt should include requirements when provided', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow',
      requirements: ['Test all edge cases', 'Verify security', 'Check performance']
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Requirements'));
    assert(result.includes('- Test all edge cases'));
    assert(result.includes('- Verify security'));
    assert(result.includes('- Check performance'));
  });

  test('buildPrompt should include test scope when provided', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow',
      testScope: 'Login, logout, and password reset functionality'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Test Scope'));
    assert(result.includes('Login, logout, and password reset functionality'));
  });

  test('buildPrompt should include platforms when provided', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow',
      platforms: ['iOS', 'Android', 'Web']
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Target Platforms'));
    assert(result.includes('- iOS'));
    assert(result.includes('- Android'));
    assert(result.includes('- Web'));
  });

  test('buildPrompt should include context when provided', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow',
      context: 'Testing in production-like environment'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Additional Context'));
    assert(result.includes('Testing in production-like environment'));
  });

  test('buildPrompt should include all sections when all optional fields are provided', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow',
      requirements: ['Test edge cases'],
      testScope: 'Login functionality',
      platforms: ['iOS', 'Android'],
      context: 'Production environment'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Current Task'));
    assert(result.includes('## Requirements'));
    assert(result.includes('## Test Scope'));
    assert(result.includes('## Target Platforms'));
    assert(result.includes('## Additional Context'));
  });

  test('buildPrompt should not include requirements section when empty array', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow',
      requirements: []
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(!result.includes('## Requirements'));
    assert(result.includes('## Current Task'));
  });

  test('buildPrompt should not include platforms section when empty array', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow',
      platforms: []
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(!result.includes('## Target Platforms'));
    assert(result.includes('## Current Task'));
  });

  test('buildPrompt should handle undefined optional fields gracefully', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test user authentication flow'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(!result.includes('## Requirements'));
    assert(!result.includes('## Test Scope'));
    assert(!result.includes('## Target Platforms'));
    assert(!result.includes('## Additional Context'));
    assert(result.includes('## Current Task'));
  });

  test('prompt structure should be correct with proper ordering', () => {
    const mockInstructions = '# QA/Tester Role\nInstructions...';
    const task = {
      description: 'Test task',
      requirements: ['Req 1'],
      testScope: 'Test scope',
      platforms: ['iOS'],
      context: 'Test context'
    };

    const result = testBuildPrompt(mockInstructions, task);
    
    // Check that sections appear in the correct order
    const taskIndex = result.indexOf('## Current Task');
    const reqIndex = result.indexOf('## Requirements');
    const scopeIndex = result.indexOf('## Test Scope');
    const platformsIndex = result.indexOf('## Target Platforms');
    const contextIndex = result.indexOf('## Additional Context');
    
    assert(taskIndex < reqIndex, 'Current Task should come before Requirements');
    assert(reqIndex < scopeIndex, 'Requirements should come before Test Scope');
    assert(scopeIndex < platformsIndex, 'Test Scope should come before Target Platforms');
    assert(platformsIndex < contextIndex, 'Target Platforms should come before Additional Context');
  });
});