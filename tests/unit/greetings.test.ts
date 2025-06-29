import { sayHello } from '../../src/greetings';

describe('Greetings', () => {
  describe('sayHello', () => {
    it('should return "Hello, World!" when called without arguments', () => {
      const result = sayHello();
      expect(result).toBe('Hello, World!');
    });
  });
});