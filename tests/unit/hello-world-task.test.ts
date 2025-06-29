import { helloWorldTask } from '../../src/hello-world-task';

describe('helloWorldTask', () => {
  it('should return "Hello, World!"', () => {
    expect(helloWorldTask()).toBe('Hello, World!');
  });
});