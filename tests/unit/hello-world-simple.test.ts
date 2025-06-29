import { helloWorldSimple } from '../../src/hello-world-simple';

describe('helloWorldSimple', () => {
  it('should return "Hello, World!"', () => {
    expect(helloWorldSimple()).toBe('Hello, World!');
  });
});