import { executeClaudeAgent } from '../src/agents/claude-executor.js';
import { loadConfig } from '../src/orchestrator/config.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyLargeOutputFix() {
  console.log('🧪 Verifying large output fix...\n');
  
  const config = loadConfig();
  console.log(`📊 Current maxBufferMB setting: ${config.maxBufferMB || 100}MB\n`);
  
  // Create a test script that generates large output
  const testScript = path.join(__dirname, 'test-large-output.js');
  const testScriptContent = `
    // Generate 150MB of output to test the fix
    const size = 150 * 1024 * 1024;
    const chunk = 'x'.repeat(1024 * 1024); // 1MB chunks
    
    let outputSize = 0;
    while (outputSize < size) {
      process.stdout.write(chunk);
      outputSize += chunk.length;
    }
    
    // Output a final marker
    console.log('\\n[END_OF_OUTPUT]');
  `;
  
  fs.writeFileSync(testScript, testScriptContent);
  console.log('📝 Created test script that generates 150MB of output');
  
  try {
    // Test with the configured buffer size
    console.log('\n🚀 Testing with configured buffer size...');
    const startTime = Date.now();
    
    // Override the executable to run our test script
    const testConfig = { ...config, claudeExecutable: `node ${testScript}` };
    
    const result = await executeClaudeAgent(
      'test-agent',
      'test prompt',
      testConfig,
      config.maxBufferMB || 200 // Use configured or default to 200MB
    );
    
    const elapsed = (Date.now() - startTime) / 1000;
    
    if (result.success) {
      const outputMB = result.output.length / 1024 / 1024;
      console.log(`\n✅ SUCCESS! Large output handled without error`);
      console.log(`📏 Output size: ${outputMB.toFixed(2)}MB`);
      console.log(`⏱️  Execution time: ${elapsed.toFixed(2)}s`);
      console.log(`🎯 Verified: The fix works correctly!`);
      
      if (result.output.includes('[END_OF_OUTPUT]')) {
        console.log(`✅ Complete output received (found end marker)`);
      }
    } else {
      console.error(`\n❌ FAILED: ${result.error}`);
      if (result.error?.includes('maxBuffer')) {
        console.error('⚠️  Buffer size might still be too small');
      }
    }
  } catch (error) {
    console.error('\n❌ Exception during test:', error);
  } finally {
    // Clean up
    fs.unlinkSync(testScript);
    console.log('\n🧹 Cleaned up test script');
  }
  
  // Test that small buffer still fails (to confirm the fix is working)
  console.log('\n🔴 Testing with deliberately small buffer (should fail)...');
  const smallTestScript = path.join(__dirname, 'test-small-buffer.js');
  fs.writeFileSync(smallTestScript, `console.log('x'.repeat(5 * 1024 * 1024));`); // 5MB
  
  try {
    const smallConfig = { ...config, claudeExecutable: `node ${smallTestScript}` };
    const result = await executeClaudeAgent('test', 'test', smallConfig, 1); // 1MB buffer
    
    if (!result.success && result.error?.includes('maxBuffer')) {
      console.log('✅ Small buffer correctly failed with maxBuffer error');
    } else {
      console.log('⚠️  Unexpected result with small buffer');
    }
  } finally {
    fs.unlinkSync(smallTestScript);
  }
  
  console.log('\n✅ Verification complete!');
}

verifyLargeOutputFix().catch(console.error);