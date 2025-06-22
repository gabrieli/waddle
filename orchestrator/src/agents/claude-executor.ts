import { spawn } from 'child_process';
import { WorkItem } from '../types/index.js';
import { OrchestratorConfig } from '../orchestrator/config.js';

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
    const args = ['-p', prompt];
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
    
    // Set a timeout of 5 minutes for Claude to respond
    const timeout = setTimeout(() => {
      clearInterval(progressInterval);
      console.log('\n   ⚠️  Claude execution timed out after 5 minutes');
      claude.kill();
      resolve({
        success: false,
        output: '',
        error: 'Claude execution timed out after 5 minutes'
      });
    }, 5 * 60 * 1000);
    
    const claude = spawn(config.claudeExecutable, args, {
      cwd: config.workingDirectory,
      env: { ...process.env },
      shell: false
    });
    
    let output = '';
    let error = '';
    
    let hasOutput = false;
    claude.stdout.on('data', (data) => {
      if (!hasOutput) {
        clearInterval(progressInterval);
        console.log('\n   📤 Claude response:');
        hasOutput = true;
      }
      const chunk = data.toString();
      output += chunk;
      // Show output in real-time
      const lines = chunk.split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          console.log(`      ${line}`);
        }
      });
    });
    
    claude.stderr.on('data', (data) => {
      const errorChunk = data.toString();
      error += errorChunk;
      // Log stderr in debug mode
      if (process.env.DEBUG === 'true') {
        console.error(`   ⚠️  stderr: ${errorChunk}`);
      }
    });
    
    claude.on('close', (code) => {
      clearTimeout(timeout);
      clearInterval(progressInterval);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n   ⏱️  Execution time: ${elapsed}s`);
      console.log(`   Claude exited with code: ${code}`);
      
      if (code === 0) {
        resolve({
          success: true,
          output: output.trim()
        });
      } else {
        console.error(`   ❌ Error output: ${error.trim() || 'No error output'}`);
        resolve({
          success: false,
          output: output.trim(),
          error: error.trim() || `Process exited with code ${code}`
        });
      }
    });
    
    claude.on('error', (err) => {
      clearTimeout(timeout);
      clearInterval(progressInterval);
      console.error(`\n   ❌ Failed to spawn Claude: ${err.message}`);
      resolve({
        success: false,
        output: '',
        error: err.message
      });
    });
  });
}