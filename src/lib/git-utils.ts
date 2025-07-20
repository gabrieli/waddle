/**
 * Git utilities for branch management
 */
import { execSync } from 'child_process';

/**
 * Get the current git branch name
 */
export function getCurrentBranch(): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    return branch;
  } catch (error) {
    // Fallback to 'main' if git command fails
    console.warn('Failed to get current git branch, using "main" as fallback:', error);
    return 'main';
  }
}

/**
 * Check if a branch exists locally
 */
export function branchExists(branchName: string): boolean {
  try {
    execSync(`git rev-parse --verify ${branchName}`, {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}