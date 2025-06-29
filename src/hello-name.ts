export function helloName(name: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return 'Hello, World!';
  }
  return `Hello, ${trimmedName}!`;
}