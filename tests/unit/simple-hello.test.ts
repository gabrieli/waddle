import { simpleHello } from '../../src/simple-hello';

describe('simpleHello', () => {
  it('should return a hello world message', () => {
    const result = simpleHello();
    expect(result).toBe('Hello World!');
  });
});