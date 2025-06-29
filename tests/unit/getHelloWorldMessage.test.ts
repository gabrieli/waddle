import { getHelloWorldMessage } from '../../src/getHelloWorldMessage';

describe('getHelloWorldMessage', () => {
  it('should return "Hello, World!" message', () => {
    const result = getHelloWorldMessage();
    expect(result).toBe('Hello, World!');
  });
});