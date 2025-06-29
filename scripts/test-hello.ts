import { simpleHello } from '../src/simple-hello';

console.log('Testing simpleHello function...');
const result = simpleHello();
console.log('Result:', result);
console.log('Test passed:', result === 'Hello World!');