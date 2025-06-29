import { myHelloWorld } from '../../src/my-hello-world';

describe('myHelloWorld', () => {
  it('should return "Hello, World!" when called', () => {
    const result = myHelloWorld();
    expect(result).toBe('Hello, World!');
  });
});