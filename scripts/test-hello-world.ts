import { helloWorld } from '../src/hello-world';
import { helloWorld as utilsHelloWorld, greetWorld, sayHello, getHelloWorld } from '../src/utils';

console.log('Testing hello world functions:\n');

console.log('1. From hello-world.ts:');
console.log('   helloWorld():', helloWorld());

console.log('\n2. From utils.ts:');
console.log('   helloWorld():', utilsHelloWorld());
console.log('   greetWorld():', greetWorld());
console.log('   sayHello():', sayHello());
console.log('   getHelloWorld():', getHelloWorld());

console.log('\n✅ All hello world functions executed successfully!');