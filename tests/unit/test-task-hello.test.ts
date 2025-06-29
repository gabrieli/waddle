import { testTaskHello } from '../../src/test-task-hello';

describe('testTaskHello', () => {
  it('should return "Hello from Test Task!"', () => {
    expect(testTaskHello()).toBe('Hello from Test Task!');
  });
});