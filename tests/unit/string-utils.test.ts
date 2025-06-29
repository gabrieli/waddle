import { capitalizeWords } from '../../src/utils';

describe('capitalizeWords', () => {
  test('should capitalize first letter of each word', () => {
    const result = capitalizeWords('hello world');
    expect(result).toBe('Hello World');
  });

  test('should handle single word', () => {
    const result = capitalizeWords('hello');
    expect(result).toBe('Hello');
  });

  test('should handle empty string', () => {
    const result = capitalizeWords('');
    expect(result).toBe('');
  });

  test('should handle multiple spaces between words', () => {
    const result = capitalizeWords('hello   world');
    expect(result).toBe('Hello   World');
  });

  test('should handle mixed case input', () => {
    const result = capitalizeWords('hELLo WoRLd');
    expect(result).toBe('Hello World');
  });
});