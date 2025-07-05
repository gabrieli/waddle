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
    const args = ['--print'];
    const claudePath = process.env.HOME + '/.claude/local/claude';
    const claude = spawn(claudePath, args, {
      cwd,
      shell: false
    });

    let output = '';
    let error = '';
    let timedOut = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      claude.kill('SIGTERM');
      const errorMessage = `Claude command timed out after ${timeout}ms`;
      if (verbose) {
        resolve({
          success: false,
          error: errorMessage
        });
      } else {
        reject(new Error(errorMessage));
      }
    }, timeout);

    // Write prompt to stdin
    claude.stdin.write(prompt);
    claude.stdin.end();

    claude.stdout.on('data', (data) => {
      output += data.toString();
    });

    claude.stderr.on('data', (data) => {
      error += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (timedOut) return; // Already handled by timeout
      
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
      
      if (timedOut) return; // Already handled by timeout
      
      const errorMessage = `Failed to start Claude: ${err.message}`;
      if (verbose) {
        resolve({
          success: false,
          error: errorMessage
        });
      } else {
        reject(new Error(errorMessage));
      }
    });
  });
}