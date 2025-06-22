import { exec } from 'child_process';
import { WorkItem } from '../types/index.js';
import { OrchestratorConfig } from '../orchestrator/config.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AgentExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function executeClaudeAgent(
  role: string,
  prompt: string,
  config: OrchestratorConfig
): Promise<AgentExecutionResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    console.log(`\n🤖 Executing ${role} agent...`);
    console.log(`   Command: ${config.claudeExecutable} -p "<prompt>"`);
    console.log(`   Prompt length: ${prompt.length} characters`);
    console.log(`   ⏳ This may take a few minutes...`);
    
    // Show prompt preview in debug mode
    if (process.env.DEBUG === 'true') {
      console.log(`   📝 Prompt preview: ${prompt.substring(0, 200)}...`);
    }
    
    // Progress indicator
    let progressDots = 0;
    const progressInterval = setInterval(() => {
      progressDots = (progressDots + 1) % 4;
      process.stdout.write(`\r   ⏳ Waiting for Claude${'.'.repeat(progressDots)}${' '.repeat(3 - progressDots)}`);
    }, 1000);
    
    // Set a timeout of 30 minutes for Claude to respond
    const timeout = setTimeout(() => {
      clearInterval(progressInterval);
      console.log('\n   ⚠️  Claude execution timed out after 30 minutes');
      claude.kill();
      resolve({
        success: false,
        output: '',
        error: 'Claude execution timed out after 30 minutes'
      });
    }, 30 * 60 * 1000);
    
    // Create a temporary file for the prompt to avoid shell escaping issues
    const tmpDir = path.join(__dirname, '../../.tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const tmpFile = path.join(tmpDir, `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.txt`);
    fs.writeFileSync(tmpFile, prompt);
    
    console.log(`   DEBUG - Prompt saved to temporary file`);
    console.log(`   DEBUG - Working directory: ${config.workingDirectory}`);
    
    // Use exec with stdin redirection
    exec(`${config.claudeExecutable} < ${tmpFile}`, {
      cwd: config.workingDirectory,
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 30 * 60 * 1000 // 30 minute timeout
    }, (error, stdout, stderr) => {
      clearTimeout(timeout);
      clearInterval(progressInterval);
      
      // Clean up temp file
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n   ⏱️  Execution time: ${elapsed}s`);
      
      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
        if (stderr) {
          console.error(`   ❌ Stderr: ${stderr}`);
        }
        resolve({
          success: false,
          output: stdout || '',
          error: error.message
        });
      } else {
        console.log(`   📤 Claude response received`);
        resolve({
          success: true,
          output: stdout.trim()
        });
      }
    });
  });
}