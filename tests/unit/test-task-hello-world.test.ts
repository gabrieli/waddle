import { helloWorld } from '../../src/test-task-hello-world';

describe('helloWorld', () => {
  it('should return "Hello, World!"', () => {
    expect(helloWorld()).toBe('Hello, World!');
  });
});