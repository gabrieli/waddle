import { helloName } from '../../src/hello-name';

describe('Hello Name', () => {
  test('should return personalized greeting', () => {
    const result = helloName('Alice');
    expect(result).toBe('Hello, Alice!');
  });

  test('should handle empty string', () => {
    const result = helloName('');
    expect(result).toBe('Hello, World!');
  });

  test('should handle whitespace', () => {
    const result = helloName('   ');
    expect(result).toBe('Hello, World!');
  });
});