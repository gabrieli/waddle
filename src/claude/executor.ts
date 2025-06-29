import { exec } from 'child_process';
import { WaddleConfig } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export interface ClaudeResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}

export class ClaudeExecutor {
  constructor(private config: WaddleConfig) {}

  async execute(prompt: string, projectPath: string): Promise<ClaudeResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      // Create a temporary file for the prompt to avoid shell escaping issues
      const tmpDir = path.join(process.cwd(), '.tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const tmpFile = path.join(tmpDir, `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.txt`);
      fs.writeFileSync(tmpFile, prompt);
      
      // Use exec with stdin redirection like the old system
      exec(`${this.config.claude.executable} < ${tmpFile}`, {
        cwd: projectPath || this.config.claude.workingDirectory,
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: this.config.claude.timeout
      }, (error, stdout, stderr) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tmpFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        const executionTime = Date.now() - startTime;
        
        if (error) {
          resolve({
            success: false,
            output: stdout || '',
            error: error.message,
            executionTime
          });
        } else {
          resolve({
            success: true,
            output: stdout.trim(),
            executionTime
          });
        }
      });
    });
  }
}