/**
 * Mock Claude client for testing
 */

export let mockClaudeResult = { success: true, output: 'Task completed successfully' };

export function setMockResult(result: { success: boolean; output?: string; error?: string }) {
  mockClaudeResult = result;
}

export async function executeClaude(prompt: string, options: any = {}) {
  if (options.verbose) {
    return mockClaudeResult;
  }
  return mockClaudeResult.success ? mockClaudeResult.output : '';
}