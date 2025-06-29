import { greetWorld } from '../../src/utils';

describe('greetWorld', () => {
  it('should return "Hello, World!"', () => {
    const result = greetWorld();
    expect(result).toBe('Hello, World!');
  });
});