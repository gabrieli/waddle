import { simpleGreeting } from '../../src/simple-greeting';

describe('simpleGreeting', () => {
  it('should return "Hello, World!"', () => {
    const result = simpleGreeting();
    expect(result).toBe('Hello, World!');
  });
});