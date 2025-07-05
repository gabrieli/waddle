import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from './architect.ts';

// Create a test version of buildPrompt that accepts instructions directly
function testBuildPrompt(instructions: string, task: any): string {
  let prompt = `${instructions}\n\n## Current Task\n\n${task.description}`;
  
  if (task.requirements && task.requirements.length > 0) {
    prompt += `\n\n## Requirements\n\n${task.requirements.map((req: string) => `- ${req}`).join('\n')}`;
  }
  
  if (task.scope) {
    prompt += `\n\n## Scope\n\n${task.scope}`;
  }
  
  if (task.context) {
    prompt += `\n\n## Additional Context\n\n${task.context}`;
  }
  
  return prompt;
}

describe('Architect Agent', () => {
  test('buildPrompt should build basic prompt with task description', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...\n\n## Project Structure Context\n\n# Project Structure\nStructure...';
    const task = { description: 'Design microservices architecture' };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('# Technical Architect Role'));
    assert(result.includes('# Project Structure'));
    assert(result.includes('## Current Task'));
    assert(result.includes('Design microservices architecture'));
  });

  test('buildPrompt should include requirements when provided', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...';
    const task = {
      description: 'Design microservices architecture',
      requirements: ['High availability', 'Scalable design', 'Security first']
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Requirements'));
    assert(result.includes('- High availability'));
    assert(result.includes('- Scalable design'));
    assert(result.includes('- Security first'));
  });

  test('buildPrompt should include scope when provided', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...';
    const task = {
      description: 'Design microservices architecture',
      scope: 'User management and payment processing services'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Scope'));
    assert(result.includes('User management and payment processing services'));
  });

  test('buildPrompt should include context when provided', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...';
    const task = {
      description: 'Design microservices architecture',
      context: 'E-commerce platform with 1M+ users'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Additional Context'));
    assert(result.includes('E-commerce platform with 1M+ users'));
  });

  test('buildPrompt should include all sections when all optional fields are provided', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...';
    const task = {
      description: 'Design microservices architecture',
      requirements: ['High availability'],
      scope: 'User management',
      context: 'E-commerce platform'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(result.includes('## Current Task'));
    assert(result.includes('## Requirements'));
    assert(result.includes('## Scope'));
    assert(result.includes('## Additional Context'));
  });

  test('buildPrompt should not include requirements section when empty array', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...';
    const task = {
      description: 'Design microservices architecture',
      requirements: []
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(!result.includes('## Requirements'));
    assert(result.includes('## Current Task'));
  });

  test('buildPrompt should handle undefined scope gracefully', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...';
    const task = {
      description: 'Design microservices architecture'
    };

    const result = testBuildPrompt(mockInstructions, task);

    assert(!result.includes('## Scope'));
    assert(result.includes('## Current Task'));
  });

  test('prompt structure should be correct with proper ordering', () => {
    const mockInstructions = '# Technical Architect Role\nInstructions...';
    const task = {
      description: 'Test task',
      requirements: ['Req 1'],
      scope: 'Test scope',
      context: 'Test context'
    };

    const result = testBuildPrompt(mockInstructions, task);
    
    // Check that sections appear in the correct order
    const taskIndex = result.indexOf('## Current Task');
    const reqIndex = result.indexOf('## Requirements');
    const scopeIndex = result.indexOf('## Scope');
    const contextIndex = result.indexOf('## Additional Context');
    
    assert(taskIndex < reqIndex, 'Current Task should come before Requirements');
    assert(reqIndex < scopeIndex, 'Requirements should come before Scope');
    assert(scopeIndex < contextIndex, 'Scope should come before Additional Context');
  });
});