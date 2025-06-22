import { spawn } from 'child_process';

console.log('🧪 Simple Claude Test\n');

// Test with shell: true (required for shell scripts)
const claude = spawn('/Users/gabrielionescu/.claude/local/claude', ['-p', 'say hi'], {
  shell: true,
  stdio: 'inherit'  // This will directly connect stdio to parent process
});

claude.on('error', (err) => {
  console.error('Error:', err);
});

claude.on('exit', (code) => {
  console.log(`\nExit code: ${code}`);
});