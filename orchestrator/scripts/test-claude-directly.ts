import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a temporary file with the prompt
const prompt = `Just respond with a simple JSON object: {"status": "ok", "message": "Hello from Claude"}`;

const tmpFile = path.join(__dirname, 'temp-prompt.txt');
fs.writeFileSync(tmpFile, prompt);

console.log('Testing Claude with file input...');

try {
  // Use the file as input
  const result = execSync(`/Users/gabrielionescu/.claude/local/claude < ${tmpFile}`, {
    encoding: 'utf8',
    cwd: '/tmp' // Use a neutral directory
  });
  
  console.log('Success! Output:');
  console.log(result);
  
} catch (error: any) {
  console.error('Error:', error.message);
  if (error.stdout) {
    console.log('Stdout:', error.stdout.toString());
  }
  if (error.stderr) {
    console.log('Stderr:', error.stderr.toString());
  }
} finally {
  // Clean up
  if (fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile);
  }
}