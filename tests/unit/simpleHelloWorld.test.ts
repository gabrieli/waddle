import { simpleHelloWorld } from '../../src/simpleHelloWorld';

describe('simpleHelloWorld', () => {
  it('should return "Hello World"', () => {
    expect(simpleHelloWorld()).toBe('Hello World');
  });
});