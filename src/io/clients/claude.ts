import { spawn } from 'child_process';

interface ClaudeResponse {
  success: boolean;
  output?: string;
  error?: string;
}

interface ClaudeOptions {
  cwd?: string;
  verbose?: boolean;
  timeout?: number;
}

/**
 * Execute a command using Claude in headless mode
 * @param prompt The prompt to send to Claude
 * @param options Additional options for the command
 * @param options.cwd - Working directory for the command
 * @param options.verbose - If true, returns full response object. If false (default), returns output string or throws error
 * @param options.timeout - Timeout in milliseconds (default: 5000)
 * @returns Promise with output string (default) or full response object (if verbose=true)
 * @throws Error if command fails and verbose=false
 */
export function executeClaude(prompt: string, options: ClaudeOptions = {}): Promise<string | ClaudeResponse> {
  const { cwd = process.cwd(), verbose = false, timeout = 5000 } = options;
  
  return new Promise((resolve, reject) => {
    const args = ['-p', '--dangerously-skip-permissions', prompt];
    const claudePath = process.env.HOME + '/.claude/local/claude';
    
    const claude = spawn(claudePath, args, {
      cwd,
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        FORCE_COLOR: '0'
      }
    });

    let output = '';
    let error = '';
    let timedOut = false;
    let resolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      timedOut = true;
      
      try {
        process.kill(-claude.pid, 'SIGKILL'); // Kill the process group
      } catch (err) {
        claude.kill('SIGKILL'); // Fallback to killing just the process
      }
      
      const errorMessage = `Claude command timed out after ${timeout}ms`;
      resolved = true;
      if (verbose) {
        resolve({
          success: false,
          output: output.trim(),
          error: errorMessage
        });
      } else {
        reject(new Error(errorMessage));
      }
    }, timeout);

    claude.stdout.on('data', (data) => {
      output += data.toString();
    });

    claude.stderr.on('data', (data) => {
      error += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (resolved) return; // Already handled
      resolved = true;
      
      const response: ClaudeResponse = {
        success: code === 0,
        output: output.trim(),
        error: code !== 0 ? (error || `Claude process exited with code ${code}`) : undefined
      };

      if (verbose) {
        resolve(response);
      } else {
        if (response.success) {
          resolve(response.output || '');
        } else {
          reject(new Error(response.error || 'Command failed'));
        }
      }
    });

    claude.on('error', (err) => {
      clearTimeout(timeoutId);
      
      if (resolved) return; // Already handled
      resolved = true;
      
      const errorMessage = `Failed to start Claude: ${err.message}`;
      if (verbose) {
        resolve({
          success: false,
          output: output.trim(),
          error: errorMessage
        });
      } else {
        reject(new Error(errorMessage));
      }
    });
  });
}