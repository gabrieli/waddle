import { taskHelloWorld } from '../../src/task-hello-world';

describe('taskHelloWorld', () => {
  it('should return "Hello World"', () => {
    expect(taskHelloWorld()).toBe('Hello World');
  });
});