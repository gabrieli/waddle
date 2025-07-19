/**
 * Test Executor Functions - Functional DI Pattern
 * 
 * Factory functions that create test execution functions with different behaviors.
 * This enables dependency injection in a functional programming style.
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Test execution result
 */
export interface TestResult {
  passed: boolean;
  output: string;
  errorOutput?: string;
}

/**
 * Test executor function type
 */
export type TestExecutor = (worktreePath: string) => Promise<TestResult>;

/**
 * Factory function: Creates a real npm test executor
 */
export function createNpmTestExecutor(): TestExecutor {
  return async function executeNpmTests(worktreePath: string): Promise<TestResult> {
    try {
      const { stdout, stderr } = await execAsync('npm run test:all', {
        cwd: worktreePath,
        env: { ...process.env }
      });
      
      return {
        passed: true,
        output: stdout,
        errorOutput: stderr || undefined
      };
    } catch (error: any) {
      return {
        passed: false,
        output: error.stdout || '',
        errorOutput: error.stderr || error.message
      };
    }
  };
}

/**
 * Factory function: Creates a mock test executor that always passes
 */
export function createMockTestExecutor(customResult?: Partial<TestResult>): TestExecutor {
  const defaultResult: TestResult = {
    passed: true,
    output: 'All tests passed in mock mode',
    errorOutput: undefined
  };
  
  const result = { ...defaultResult, ...customResult };
  
  return async function executeMockTests(_worktreePath: string): Promise<TestResult> {
    // Simulate some async delay to be realistic
    await new Promise(resolve => setTimeout(resolve, 100));
    return result;
  };
}

/**
 * Factory function: Creates a mock test executor that always fails
 */
export function createFailingTestExecutor(
  output: string = 'Some tests failed',
  errorOutput: string = 'Test failures detected'
): TestExecutor {
  return createMockTestExecutor({
    passed: false,
    output,
    errorOutput
  });
}

/**
 * Factory function: Creates a test executor that simulates timeout/error
 */
export function createTimeoutTestExecutor(
  timeoutMs: number = 5000,
  errorMessage: string = 'Test execution timed out'
): TestExecutor {
  return async function executeTimeoutTests(_worktreePath: string): Promise<TestResult> {
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
    throw new Error(errorMessage);
  };
}

/**
 * Factory function: Creates a test executor with custom behavior
 */
export function createCustomTestExecutor(
  testFn: (worktreePath: string) => Promise<TestResult>
): TestExecutor {
  return testFn;
}

/**
 * Higher-order function: Adds logging to any test executor
 */
export function withLogging(executor: TestExecutor): TestExecutor {
  return async function loggingTestExecutor(worktreePath: string): Promise<TestResult> {
    console.log(`[TestExecutor] Starting tests in: ${worktreePath}`);
    const startTime = Date.now();
    
    try {
      const result = await executor(worktreePath);
      const duration = Date.now() - startTime;
      console.log(`[TestExecutor] Tests ${result.passed ? 'passed' : 'failed'} in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`[TestExecutor] Test execution failed after ${duration}ms:`, error.message);
      throw error;
    }
  };
}

/**
 * Higher-order function: Adds retry logic to any test executor
 */
export function withRetry(
  executor: TestExecutor, 
  maxRetries: number = 3,
  delay: number = 1000
): TestExecutor {
  return async function retryingTestExecutor(worktreePath: string): Promise<TestResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await executor(worktreePath);
        if (result.passed || attempt === maxRetries) {
          return result;
        }
        // If failed but not last attempt, wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxRetries) {
          throw lastError;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  };
}

/**
 * Default test executor factory - used when no executor is provided
 */
export function createDefaultTestExecutor(): TestExecutor {
  return withLogging(createNpmTestExecutor());
}