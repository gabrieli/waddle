import { hello } from '../src/hello';

describe('hello function', () => {
  it('should return "Hello, World!"', () => {
    expect(hello()).toBe('Hello, World!');
  });
});