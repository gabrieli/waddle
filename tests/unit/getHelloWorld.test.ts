import { getHelloWorld } from '../../src/utils';

describe('getHelloWorld', () => {
  test('should return "Hello World"', () => {
    const result = getHelloWorld();
    expect(result).toBe('Hello World');
  });
});