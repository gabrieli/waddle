/**
 * Mock Claude client for testing
 */

export let mockClaudeResult = { success: true, output: 'Task completed successfully' };
export let lastPrompt: string | null = null;
export let lastOptions: any = null;

export function setMockResult(result: { success: boolean; output?: string; error?: string }) {
  mockClaudeResult = result;
}

export function getLastCall() {
  return { prompt: lastPrompt, options: lastOptions };
}

export function resetMockCapture() {
  lastPrompt = null;
  lastOptions = null;
}

export async function executeClaude(prompt: string, options: any = {}) {
  // Capture the call for verification
  lastPrompt = prompt;
  lastOptions = { ...options };
  
  if (options.verbose) {
    return mockClaudeResult;
  }
  return mockClaudeResult.success ? mockClaudeResult.output : '';
}