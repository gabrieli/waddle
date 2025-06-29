export function helloWorld(): string {
  return 'Hello, World!';
}

export function greetWorld(): string {
  return 'Hello, World!';
}

export function capitalizeWords(str: string): string {
  if (!str) return '';
  
  return str
    .split(' ')
    .map(word => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function isValidEmail(email: any): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // More strict regex that only allows alphanumeric, dots, hyphens, underscores, and plus signs before @
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function testTask(input?: string): string {
  if (!input || input === '') {
    return 'Test task completed successfully';
  }
  return `Test task completed successfully with input: ${input}`;
}

export function sayHello(): string {
  return 'Hello, World!';
}

export function getHelloWorld(): string {
  return 'Hello World';
}

export function simpleHello(): string {
  return 'Hello!';
}