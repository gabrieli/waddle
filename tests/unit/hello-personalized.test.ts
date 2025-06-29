import { helloPersonalized } from '../../src/hello-personalized';

describe('Hello Personalized', () => {
  test('should return personalized hello message with name', () => {
    const result = helloPersonalized('Alice');
    expect(result).toBe('Hello, Alice!');
  });

  test('should return personalized hello message with different name', () => {
    const result = helloPersonalized('Bob');
    expect(result).toBe('Hello, Bob!');
  });

  test('should handle empty string', () => {
    const result = helloPersonalized('');
    expect(result).toBe('Hello, !');
  });
});