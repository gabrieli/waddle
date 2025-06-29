/**
 * Capitalizes the first letter of each word in a string
 * @param str - The input string to capitalize
 * @returns The string with each word's first letter capitalized
 */
export function capitalizeWords(str: string): string {
  if (!str) return '';
  
  // Functional approach: transform each word independently
  const capitalizeWord = (word: string): string => 
    word.length === 0 
      ? '' 
      : word[0].toUpperCase() + word.slice(1).toLowerCase();
  
  // Preserve original spacing by using regex
  return str.replace(/\S+/g, capitalizeWord);
}