import { helloWorld } from '../../src/hello-world-function';

describe('helloWorld', () => {
  it('should return "Hello, World!"', () => {
    const result = helloWorld();
    expect(result).toBe('Hello, World!');
  });
});