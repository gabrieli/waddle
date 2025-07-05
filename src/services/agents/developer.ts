import { execSync } from 'child_process';

function testClaudeCommand() {
  try {
    console.log('Testing claude command...');
    const result = execSync('claude -p "say hi"', { 
      encoding: 'utf8',
      timeout: 60000,
      stdio: 'pipe'
    });
    console.log('Claude response:', result);
    return true;
  } catch (error) {
    console.error('Error calling claude:', error.message);
    return false;
  }
}

// Run the test
const success = testClaudeCommand();
console.log(`Claude test ${success ? 'passed' : 'failed'}`);

export { testClaudeCommand };