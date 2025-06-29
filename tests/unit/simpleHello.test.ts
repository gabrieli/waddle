import { simpleHello } from '../../src/utils';

describe('simpleHello', () => {
  it('should return a simple hello message', () => {
    const result = simpleHello();
    expect(result).toBe('Hello!');
  });
});