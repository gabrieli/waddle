import { sayHello } from '../../src/utils';

describe('sayHello', () => {
  it('should return a hello world message', () => {
    const result = sayHello();
    expect(result).toBe('Hello, World!');
  });
});