import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const claudeExecutable = '/Users/gabrielionescu/.claude/local/claude';

console.log('🧪 Testing Claude execution...\n');

// First, test with exec to see if it works
testWithExec();

async function testWithExec() {
  console.log('Test 1: Using exec (for shell scripts)');
  console.log('=====================================');
  
  try {
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(`${claudeExecutable} -p "say hi"`);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('✅ Success!');
    console.log(`⏱️  Execution time: ${elapsed}s`);
    console.log(`📤 Output: ${stdout}`);
    if (stderr) {
      console.log(`⚠️  stderr: ${stderr}`);
    }
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
  }
  
  console.log('\n\nTest 2: Using spawn with shell: true');
  console.log('=====================================');
  testWithSpawnShell();
}

function testWithSpawnShell() {
  const startTime = Date.now();
  
  console.log(`Command: ${claudeExecutable} -p "say hi"`);
  console.log('');
  
  // For shell scripts, we need shell: true
  const claude = spawn(claudeExecutable, ['-p', 'say hi'], {
    cwd: process.cwd(),
    env: { ...process.env },
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let error = '';
  
  claude.stdout.on('data', (data) => {
    const chunk = data.toString();
    output += chunk;
    console.log(`📤 Output: ${chunk.trim()}`);
  });
  
  claude.stderr.on('data', (data) => {
    const chunk = data.toString();
    error += chunk;
    console.error(`⚠️  stderr: ${chunk}`);
  });
  
  claude.on('close', (code) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Process closed with code: ${code}`);
    console.log(`⏱️  Execution time: ${elapsed}s`);
    
    console.log('\n\nTest 3: Direct node binary execution');
    console.log('=====================================');
    testDirectNodeBinary();
  });
  
  claude.on('error', (err) => {
    console.error(`\n❌ Failed to spawn Claude: ${err.message}`);
  });
}

function testDirectNodeBinary() {
  const startTime = Date.now();
  const nodeBinary = '/Users/gabrielionescu/.claude/local/node_modules/.bin/claude';
  
  console.log(`Direct binary: ${nodeBinary}`);
  console.log('');
  
  const claude = spawn(nodeBinary, ['-p', 'say hi'], {
    cwd: process.cwd(),
    env: { ...process.env },
    shell: false
  });
  
  let output = '';
  
  claude.stdout.on('data', (data) => {
    const chunk = data.toString();
    output += chunk;
    console.log(`📤 Output: ${chunk.trim()}`);
  });
  
  claude.stderr.on('data', (data) => {
    console.error(`⚠️  stderr: ${data.toString()}`);
  });
  
  claude.on('close', (code) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Process closed with code: ${code}`);
    console.log(`⏱️  Execution time: ${elapsed}s`);
  });
  
  claude.on('error', (err) => {
    console.error(`\n❌ Failed to spawn Claude: ${err.message}`);
  });
}