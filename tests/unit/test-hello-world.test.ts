import { testHelloWorld } from '../../src/test-hello-world';

describe('testHelloWorld', () => {
  it('should return "Hello World from Test Task"', () => {
    expect(testHelloWorld()).toBe('Hello World from Test Task');
  });
});