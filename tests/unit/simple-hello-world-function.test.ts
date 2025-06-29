import { simpleHelloWorld } from '../../src/simple-hello-world';

describe('simpleHelloWorld', () => {
  it('should return "Hello World"', () => {
    expect(simpleHelloWorld()).toBe('Hello World');
  });
});