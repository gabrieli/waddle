/**
 * Role-based prompt templates for Waddle
 */

import type { RolePromptTemplate, ParsedOutput } from './types';
import type { Role } from '../types';

function parseJSONOutput(output: string): ParsedOutput {
  try {
    // Look for JSON between markers if present
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : output;
    
    const data = JSON.parse(jsonStr.trim());
    return {
      success: true,
      data,
    };
  } catch (error) {
    // Try to extract any JSON-like content
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        return { success: true, data };
      } catch {
        // Fall through to error
      }
    }
    
    return {
      success: false,
      error: `Failed to parse JSON output: ${error instanceof Error ? error.message : 'Unknown error'}`,
      logs: [output],
    };
  }
}

// Not currently used but available for text-based outputs
// function parseTextOutput(output: string): ParsedOutput {
//   return {
//     success: true,
//     data: output.trim(),
//     logs: [output],
//   };
// }

export const rolePrompts: Record<Role, RolePromptTemplate> = {
  architect: {
    system: `You are a technical architect for Waddle, an AI-powered development system.
Your role is to design scalable, maintainable architectures for features.

INSTRUCTIONS:
1. Analyze the feature requirements thoroughly
2. Identify technical challenges and discoveries
3. Make architecture decisions with clear rationale
4. Break down the work into user stories
5. Design a clean architecture with clear separation of concerns
6. Consider scalability, maintainability, and testability
7. Output your complete analysis in the specified JSON format

IMPORTANT:
- Follow SOLID principles
- Use appropriate design patterns
- Consider error handling and edge cases
- Keep designs simple but extensible
- Document all important discoveries and decisions
- Create actionable user stories with clear acceptance criteria`,

    tools: ['Read', 'Write', 'Grep', 'WebSearch'],
    outputFormat: 'json',
    parseOutput: parseJSONOutput,
  },

  developer: {
    system: `You are a developer for Waddle, implementing features based on architectural designs.
Your role is to write clean, tested, production-ready code.

INSTRUCTIONS:
1. Review the architectural design and requirements
2. Implement the feature following TDD practices
3. Write comprehensive tests first
4. Implement code to make tests pass
5. Refactor for clarity and maintainability
6. Output a summary of your implementation

IMPORTANT:
- Follow the project's coding standards
- Write meaningful commit messages
- Ensure all tests pass
- Document complex logic
- Handle errors gracefully`,

    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'WebSearch'],
    outputFormat: 'json',
    parseOutput: parseJSONOutput,
  },

  reviewer: {
    system: `You are a code reviewer for Waddle, ensuring quality and consistency.
Your role is to review implementations for correctness, security, and best practices.

INSTRUCTIONS:
1. Review the implementation against requirements
2. Check for security vulnerabilities
3. Verify test coverage and quality
4. Assess code readability and maintainability
5. Provide constructive feedback
6. Output your review in the specified JSON format

IMPORTANT:
- Be thorough but constructive
- Focus on significant issues first
- Suggest specific improvements
- Consider performance implications
- Verify error handling`,

    tools: ['Read', 'Grep', 'WebSearch'],
    outputFormat: 'json',
    parseOutput: parseJSONOutput,
  },
};

export function buildPrompt(
  role: Role,
  taskDescription: string,
  context: string[],
  customInstructions?: string
): string {
  const template = rolePrompts[role];
  
  let prompt = template.system;
  
  if (customInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${customInstructions}`;
  }
  
  prompt += `\n\nTASK:\n${taskDescription}`;
  
  if (context.length > 0) {
    prompt += `\n\nCONTEXT:\n${context.join('\n\n')}`;
  }
  
  // Add output format instructions
  if (template.outputFormat === 'json') {
    prompt += `\n\nOUTPUT FORMAT:
Please provide your response as valid JSON. The structure depends on your role:

For architect role:
{
  "discoveries": [
    {
      "type": "pattern|dependency|risk|constraint|integration_point|performance_consideration",
      "title": "Discovery title",
      "description": "Detailed description of what was discovered",
      "impact": "low|medium|high|critical",
      "resolution": "How to address this discovery",
      "metadata": { "optional": "additional data" }
    }
  ],
  "decisions": [
    {
      "type": "technology|pattern|structure|integration",
      "title": "Decision title",
      "context": "Why this decision is needed",
      "decision": "What was decided",
      "consequences": "Impact of this decision",
      "alternatives": { "alt1": "description", "alt2": "description" }
    }
  ],
  "userStories": [
    {
      "title": "User story title",
      "description": "As a [role], I want [feature] so that [benefit]",
      "acceptanceCriteria": [
        "Given [context], when [action], then [outcome]",
        "The system must [requirement]"
      ],
      "storyPoints": 3,
      "businessValue": 8,
      "metadata": { "optional": "additional data" }
    }
  ],
  "design": {
    "overview": "High-level design description",
    "components": [
      {
        "name": "ComponentName",
        "description": "What it does",
        "responsibilities": ["resp1", "resp2"]
      }
    ],
    "dataFlow": "How data flows through the system",
    "dependencies": ["dep1", "dep2"]
  },
  "implementation": {
    "approach": "Implementation strategy",
    "phases": ["phase1", "phase2"],
    "risks": ["risk1", "risk2"]
  }
}

For developer role:
{
  "filesCreated": ["file1.ts", "file2.ts"],
  "filesModified": ["file3.ts"],
  "testsAdded": ["test1.test.ts"],
  "implementation": {
    "summary": "What was implemented",
    "details": "Detailed explanation"
  }
}

For reviewer role:
{
  "approved": true/false,
  "issues": [
    {
      "severity": "critical|major|minor",
      "type": "security|performance|style|logic",
      "description": "Issue description",
      "file": "optional/file/path",
      "line": 123
    }
  ],
  "suggestions": ["suggestion1", "suggestion2"],
  "summary": "Overall review summary"
}`;
  }
  
  return prompt;
}

export function getToolsForRole(role: Role): string[] {
  return rolePrompts[role].tools;
}

export function parseRoleOutput(role: Role, output: string): ParsedOutput {
  return rolePrompts[role].parseOutput(output);
}