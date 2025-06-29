import { devTaskHello } from '../../src/dev-task-hello';

describe('devTaskHello', () => {
  it('should return "Hello, World!"', () => {
    const result = devTaskHello();
    expect(result).toBe('Hello, World!');
  });
});