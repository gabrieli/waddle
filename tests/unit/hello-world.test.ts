import { helloWorld } from '../../src/hello-world';

describe('helloWorld', () => {
  it('should return "Hello, World!"', () => {
    expect(helloWorld()).toBe('Hello, World!');
  });
});