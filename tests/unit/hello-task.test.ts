import { hello } from '../../src/hello';

describe('hello', () => {
  it('should return "Hello, World!"', () => {
    const result = hello();
    expect(result).toBe('Hello, World!');
  });
});