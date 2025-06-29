import { spawn } from 'child_process';
import * as path from 'path';

const claudeExecutable = '/Users/gabrielionescu/.claude/local/claude';

console.log('🧪 Testing Claude execution...\n');

// Test 1: Basic spawn without shell
console.log('Test 1: Basic spawn (shell: false)');
console.log('=====================================');
testClaude(false);

// Test 2: Spawn with shell after a delay
setTimeout(() => {
  console.log('\n\nTest 2: Spawn with shell (shell: true)');
  console.log('=====================================');
  testClaude(true);
}, 5000);

function testClaude(useShell: boolean) {
  const startTime = Date.now();
  const args = ['-p', 'say hi'];
  
  console.log(`Executable: ${claudeExecutable}`);
  console.log(`Arguments: ${JSON.stringify(args)}`);
  console.log(`Shell: ${useShell}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log('');
  
  const claude = spawn(claudeExecutable, args, {
    cwd: process.cwd(),
    env: { ...process.env },
    shell: useShell
  });
  
  let output = '';
  let error = '';
  let hasOutput = false;
  
  // Handle stdout
  claude.stdout.on('data', (data) => {
    if (!hasOutput) {
      console.log('📤 Received stdout data:');
      hasOutput = true;
    }
    const chunk = data.toString();
    output += chunk;
    process.stdout.write(chunk);
  });
  
  // Handle stderr
  claude.stderr.on('data', (data) => {
    const chunk = data.toString();
    error += chunk;
    console.error(`⚠️  stderr: ${chunk}`);
  });
  
  // Handle close
  claude.on('close', (code) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Process closed with code: ${code}`);
    console.log(`⏱️  Execution time: ${elapsed}s`);
    console.log(`📊 Total output length: ${output.length} chars`);
    if (error) {
      console.log(`❌ Total error length: ${error.length} chars`);
    }
  });
  
  // Handle error
  claude.on('error', (err) => {
    console.error(`\n❌ Failed to spawn Claude: ${err.message}`);
    console.error('Error details:', err);
  });
  
  // Handle exit
  claude.on('exit', (code, signal) => {
    if (signal) {
      console.log(`⚠️  Process killed by signal: ${signal}`);
    }
  });
}