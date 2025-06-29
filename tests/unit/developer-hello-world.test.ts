import { getDeveloperHelloWorld } from '../../src/developer-hello-world';

describe('getDeveloperHelloWorld', () => {
  it('should return "Hello, World!"', () => {
    const result = getDeveloperHelloWorld();
    expect(result).toBe('Hello, World!');
  });
});