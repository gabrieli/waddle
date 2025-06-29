describe('helloWorld', () => {
  it('should return "Hello, World!"', () => {
    const { helloWorld } = require('../../src/new-hello-world');
    expect(helloWorld()).toBe('Hello, World!');
  });
});