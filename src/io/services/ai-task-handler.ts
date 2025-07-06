/**
 * AI Task Handler
 * 
 * Simple AI task processor that can handle mathematical operations
 * and other basic tasks for integration testing.
 */

export interface AITaskResult {
  success: boolean;
  result?: any;
  error?: string;
}

export class AITaskHandler {
  /**
   * Process a task with AI-like capabilities
   */
  async processTask(taskDescription: string): Promise<AITaskResult> {
    try {
      // Simple math parser for testing
      const mathMatch = taskDescription.match(/(\d+)\s*\+\s*(\d+)/);
      if (mathMatch) {
        const a = parseInt(mathMatch[1]);
        const b = parseInt(mathMatch[2]);
        return {
          success: true,
          result: `${a} + ${b} = ${a + b}`
        };
      }

      // Handle other simple operations
      const subtractMatch = taskDescription.match(/(\d+)\s*\-\s*(\d+)/);
      if (subtractMatch) {
        const a = parseInt(subtractMatch[1]);
        const b = parseInt(subtractMatch[2]);
        return {
          success: true,
          result: `${a} - ${b} = ${a - b}`
        };
      }

      const multiplyMatch = taskDescription.match(/(\d+)\s*\*\s*(\d+)/);
      if (multiplyMatch) {
        const a = parseInt(multiplyMatch[1]);
        const b = parseInt(multiplyMatch[2]);
        return {
          success: true,
          result: `${a} * ${b} = ${a * b}`
        };
      }

      // Handle text-based tasks
      if (taskDescription.toLowerCase().includes('hello')) {
        return {
          success: true,
          result: 'Hello! Task processed successfully.'
        };
      }

      // Default case
      return {
        success: true,
        result: `Processed task: ${taskDescription}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export function createAITaskHandler(): AITaskHandler {
  return new AITaskHandler();
}