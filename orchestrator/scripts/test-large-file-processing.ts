import { executeClaudeAgent } from '../src/agents/claude-executor.js';
import { loadConfig } from '../src/orchestrator/config.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testLargeFileProcessing() {
  console.log('🧪 Testing large file processing...');
  
  // Create a large test prompt (100MB+)
  const largePrompt = createLargePrompt(110); // 110MB
  
  console.log(`📏 Created prompt size: ${(largePrompt.length / 1024 / 1024).toFixed(2)}MB`);
  
  try {
    const config = loadConfig();
    
    console.log('🚀 Executing Claude agent with large prompt...');
    const startTime = Date.now();
    
    const result = await executeClaudeAgent(
      'test-agent',
      largePrompt,
      config
    );
    
    const elapsedTime = Date.now() - startTime;
    console.log(`⏱️ Execution time: ${(elapsedTime / 1000).toFixed(2)}s`);
    
    if (result.success) {
      console.log('✅ Success! Agent processed large input without ENOMEM error');
      console.log(`📤 Output size: ${(result.output.length / 1024 / 1024).toFixed(2)}MB`);
    } else {
      console.error('❌ Failed:', result.error);
      if (result.error?.includes('ENOMEM') || result.error?.includes('maxBuffer')) {
        console.error('🐛 BUG REPRODUCED: Memory/buffer error with large files');
      }
    }
  } catch (error) {
    console.error('❌ Error during test:', error);
    if (error instanceof Error && (error.message.includes('ENOMEM') || error.message.includes('maxBuffer'))) {
      console.error('🐛 BUG REPRODUCED: Memory/buffer error with large files');
    }
  }
}

function createLargePrompt(sizeMB: number): string {
  // Create a prompt that's approximately sizeMB in size
  const bytesPerMB = 1024 * 1024;
  const targetBytes = sizeMB * bytesPerMB;
  
  // Build a realistic prompt with repeated content
  const baseContent = `
# Large Test Prompt

This is a test prompt designed to reproduce memory issues with large file processing.
Here's some sample code that might be included in a real prompt:

\`\`\`typescript
function processData(input: string): string {
  // Process the input data
  const lines = input.split('\\n');
  const processed = lines.map(line => {
    // Some processing logic
    return line.toUpperCase().trim();
  });
  return processed.join('\\n');
}
\`\`\`

Additional context and requirements:
- The system should handle large inputs gracefully
- Memory usage should be optimized for streaming
- Buffer sizes should be configurable
- Error handling should be robust

`;
  
  let prompt = baseContent;
  const contentLength = baseContent.length;
  const repetitions = Math.ceil(targetBytes / contentLength);
  
  for (let i = 0; i < repetitions; i++) {
    if (prompt.length >= targetBytes) break;
    prompt += baseContent;
  }
  
  return prompt.substring(0, targetBytes);
}

// Test different file sizes
async function runTests() {
  console.log('🧪 Running large file processing tests...\n');
  
  // Test with progressively larger files
  const testSizes = [1, 10, 50, 100, 150]; // MB
  
  for (const size of testSizes) {
    console.log(`\n📊 Testing with ${size}MB prompt...`);
    const prompt = createLargePrompt(size);
    
    try {
      const config = loadConfig();
      const result = await executeClaudeAgent('test-agent', prompt, config);
      
      if (result.success) {
        console.log(`✅ ${size}MB: Success`);
      } else {
        console.log(`❌ ${size}MB: Failed - ${result.error}`);
        if (result.error?.includes('maxBuffer') || result.error?.includes('ENOMEM')) {
          console.log(`🐛 Memory issue detected at ${size}MB`);
          break;
        }
      }
    } catch (error) {
      console.log(`❌ ${size}MB: Exception - ${error}`);
      break;
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}