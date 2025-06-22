import { executeClaudeAgent } from '../src/agents/claude-executor.js';
import { OrchestratorConfig } from '../src/orchestrator/config.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock config
const mockConfig: OrchestratorConfig = {
  pollingInterval: 30000,
  claudeExecutable: 'echo', // Use echo for testing
  workingDirectory: process.cwd(),
  database: './test.db',
  maxBufferMB: 200,
  agents: {
    manager: { model: 'sonnet' },
    architect: { model: 'opus' },
    developer: { model: 'opus' }
  }
};

async function testMaxBufferFix() {
  console.log('🧪 Testing maxBuffer fix...\n');
  
  // Test 1: Small output (should work with any buffer)
  console.log('Test 1: Small output');
  const smallResult = await executeClaudeAgent(
    'test',
    'Small test output',
    mockConfig,
    10
  );
  console.log(`✅ Small output result: ${smallResult.success}`);
  
  // Test 2: Large output with default buffer (100MB)
  console.log('\nTest 2: Large output with default buffer');
  const largePrompt = 'x'.repeat(50 * 1024 * 1024); // 50MB
  mockConfig.claudeExecutable = `node -e "console.log('${'y'.repeat(80 * 1024 * 1024)}')"`;
  
  const largeResult = await executeClaudeAgent(
    'test',
    largePrompt,
    mockConfig
  );
  console.log(`✅ Large output with default buffer (100MB): ${largeResult.success}`);
  
  // Test 3: Using config maxBufferMB
  console.log('\nTest 3: Using config maxBufferMB (200MB)');
  const configResult = await executeClaudeAgent(
    'test',
    largePrompt,
    mockConfig,
    mockConfig.maxBufferMB
  );
  console.log(`✅ Large output with config buffer (200MB): ${configResult.success}`);
  
  console.log('\n✅ All tests completed!');
}

testMaxBufferFix().catch(console.error);