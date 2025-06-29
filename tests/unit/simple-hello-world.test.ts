import { simpleHelloWorld } from '../../src/utils/simple-hello-world';

describe('simpleHelloWorld', () => {
  test('should return "Hello, World!"', () => {
    const result = simpleHelloWorld();
    expect(result).toBe('Hello, World!');
  });
});