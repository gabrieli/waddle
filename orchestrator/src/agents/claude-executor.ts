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
  config: OrchestratorConfig,
  maxBufferMB: number = 100 // Default to 100MB instead of 10MB
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
    
    // Check if timeout simulation is enabled
    if (config.timeoutSimulation?.enabled) {
      const shouldInjectDelay = !config.timeoutSimulation.operations || 
        config.timeoutSimulation.operations.includes(role);
      
      if (shouldInjectDelay && config.timeoutSimulation.delayMs) {
        console.log(`\n   🚨 TIMEOUT SIMULATION: Injecting ${config.timeoutSimulation.delayMs}ms delay for ${role} agent`);
        console.log(`   ⚠️  This is for testing purposes only`);
      }
    }
    
    // Progress indicator
    let progressDots = 0;
    const progressInterval = setInterval(() => {
      progressDots = (progressDots + 1) % 4;
      process.stdout.write(`\r   ⏳ Waiting for Claude${'.'.repeat(progressDots)}${' '.repeat(3 - progressDots)}`);
    }, 1000);
    
    // Set a timeout for Claude to respond (accounting for any injected delay)
    const baseTimeoutMs = 30 * 60 * 1000; // 30 minutes base
    const injectedDelayMs = (config.timeoutSimulation?.enabled && config.timeoutSimulation?.delayMs) || 0;
    const totalTimeoutMs = baseTimeoutMs + injectedDelayMs;
    
    const timeout = setTimeout(() => {
      clearInterval(progressInterval);
      console.log('\n   ⚠️  Claude execution timed out');
      console.log(`   ⏱️  Timeout details: base=${baseTimeoutMs}ms, delay=${injectedDelayMs}ms, total=${totalTimeoutMs}ms`);
      // Note: exec already has a timeout, this is just for the progress indicator
      resolve({
        success: false,
        output: '',
        error: `Claude execution timed out after ${totalTimeoutMs}ms (including ${injectedDelayMs}ms simulated delay)`
      });
    }, totalTimeoutMs);
    
    // Create a temporary file for the prompt to avoid shell escaping issues
    const tmpDir = path.join(__dirname, '../../.tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const tmpFile = path.join(tmpDir, `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.txt`);
    fs.writeFileSync(tmpFile, prompt);
    
    console.log(`   DEBUG - Prompt saved to temporary file`);
    console.log(`   DEBUG - Working directory: ${config.workingDirectory}`);
    console.log(`   DEBUG - Max buffer size: ${maxBufferMB}MB`);
    
    // Inject delay if timeout simulation is enabled
    const executeCommand = async () => {
      if (config.timeoutSimulation?.enabled) {
        const shouldInjectDelay = !config.timeoutSimulation.operations || 
          config.timeoutSimulation.operations.includes(role);
        
        if (shouldInjectDelay && config.timeoutSimulation.delayMs) {
          const delayMs = config.timeoutSimulation.delayMs;
          console.log(`\n   ⏱️  Starting artificial delay of ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          console.log(`   ✅ Delay completed, proceeding with execution`);
        }
      }
      
      // Use exec with stdin redirection
      exec(`${config.claudeExecutable} < ${tmpFile}`, {
      cwd: config.workingDirectory,
      env: { ...process.env },
      maxBuffer: maxBufferMB * 1024 * 1024, // Configurable buffer size
      timeout: totalTimeoutMs // Dynamic timeout based on configuration
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
    };
    
    // Execute the command (with potential delay)
    executeCommand();
  });
}