import { greetUser } from '../../src/greeting';

describe('greetUser', () => {
  test('should greet a user by name', () => {
    expect(greetUser('Alice')).toBe('Hello, Alice!');
  });

  test('should handle empty string', () => {
    expect(greetUser('')).toBe('Hello, !');
  });

  test('should handle names with spaces', () => {
    expect(greetUser('John Doe')).toBe('Hello, John Doe!');
  });

  test('should handle special characters', () => {
    expect(greetUser('María José')).toBe('Hello, María José!');
  });

  test('should handle numbers in names', () => {
    expect(greetUser('User123')).toBe('Hello, User123!');
  });
});