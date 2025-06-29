import { helloWorld } from '../../src/utils';

describe('helloWorld', () => {
  it('should return "Hello, World!"', () => {
    const result = helloWorld();
    expect(result).toBe('Hello, World!');
  });
});