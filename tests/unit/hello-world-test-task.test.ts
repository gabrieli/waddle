import { helloWorldTestTask } from '../../src/hello-world-test-task';

describe('helloWorldTestTask', () => {
  it('should return "Hello, World!"', () => {
    const result = helloWorldTestTask();
    
    expect(result).toBe('Hello, World!');
  });
});