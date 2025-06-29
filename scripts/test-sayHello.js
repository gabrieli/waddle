const { sayHello } = require('../dist/utils');

console.log('Testing sayHello function...');
const result = sayHello();
console.log('Result:', result);

if (result === 'Hello, World!') {
  console.log('✓ Test passed!');
  process.exit(0);
} else {
  console.log('✗ Test failed!');
  process.exit(1);
}