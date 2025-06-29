import { testTask } from '../../src/utils';

describe('testTask', () => {
  test('should return default message when no input provided', () => {
    expect(testTask()).toBe('Test task completed successfully');
    expect(testTask('')).toBe('Test task completed successfully');
  });

  test('should return message with input when input is provided', () => {
    expect(testTask('hello')).toBe('Test task completed successfully with input: hello');
    expect(testTask('world')).toBe('Test task completed successfully with input: world');
  });

  test('should handle various input types', () => {
    expect(testTask('123')).toBe('Test task completed successfully with input: 123');
    expect(testTask('test@example.com')).toBe('Test task completed successfully with input: test@example.com');
    expect(testTask('multi word input')).toBe('Test task completed successfully with input: multi word input');
  });

  test('should handle special characters in input', () => {
    expect(testTask('!@#$%')).toBe('Test task completed successfully with input: !@#$%');
    expect(testTask('line\nbreak')).toBe('Test task completed successfully with input: line\nbreak');
    expect(testTask('tab\ttab')).toBe('Test task completed successfully with input: tab\ttab');
  });

  test('should handle edge cases with whitespace', () => {
    expect(testTask('  ')).toBe('Test task completed successfully with input:   ');
    expect(testTask(' trim me ')).toBe('Test task completed successfully with input:  trim me ');
  });

  test('should handle very long input strings', () => {
    const longInput = 'a'.repeat(1000);
    expect(testTask(longInput)).toBe(`Test task completed successfully with input: ${longInput}`);
  });

  test('should handle unicode characters', () => {
    expect(testTask('😀🎉')).toBe('Test task completed successfully with input: 😀🎉');
    expect(testTask('こんにちは')).toBe('Test task completed successfully with input: こんにちは');
    expect(testTask('Привет')).toBe('Test task completed successfully with input: Привет');
  });

  test('should handle null and undefined explicitly', () => {
    expect(testTask(null as any)).toBe('Test task completed successfully');
    expect(testTask(undefined)).toBe('Test task completed successfully');
  });
});
