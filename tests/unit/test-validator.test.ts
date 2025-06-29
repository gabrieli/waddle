import { validateTestResult, TestResult } from '../../src/test-validator';

describe('Test Validator', () => {
  describe('validateTestResult', () => {
    test('should return true for passing test', () => {
      const testResult: TestResult = {
        name: 'sample test',
        status: 'passed',
        duration: 100
      };
      
      const isValid = validateTestResult(testResult);
      expect(isValid).toBe(true);
    });

    test('should return false for failing test', () => {
      const testResult: TestResult = {
        name: 'sample test',
        status: 'failed',
        duration: 100,
        error: 'Test assertion failed'
      };
      
      const isValid = validateTestResult(testResult);
      expect(isValid).toBe(false);
    });

    test('should return false for test with negative duration', () => {
      const testResult: TestResult = {
        name: 'sample test',
        status: 'passed',
        duration: -10
      };
      
      const isValid = validateTestResult(testResult);
      expect(isValid).toBe(false);
    });

    test('should return false for test with empty name', () => {
      const testResult: TestResult = {
        name: '',
        status: 'passed',
        duration: 100
      };
      
      const isValid = validateTestResult(testResult);
      expect(isValid).toBe(false);
    });

    test('should return false for test with invalid status', () => {
      const testResult: TestResult = {
        name: 'sample test',
        status: 'unknown' as any,
        duration: 100
      };
      
      const isValid = validateTestResult(testResult);
      expect(isValid).toBe(false);
    });
  });
});