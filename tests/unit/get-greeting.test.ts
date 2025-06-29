import { getGreeting } from '../../src/get-greeting';

describe('getGreeting', () => {
  test('should return "Hello, World!"', () => {
    const result = getGreeting();
    expect(result).toBe('Hello, World!');
  });
});