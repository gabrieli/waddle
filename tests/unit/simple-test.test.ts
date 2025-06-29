import { getHelloWorld } from '../../src/simple-test';

describe('Simple Test', () => {
  it('should return "Hello World"', () => {
    const result = getHelloWorld();
    expect(result).toBe('Hello World');
  });
});