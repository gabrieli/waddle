import { capitalizeWords } from '../../../src/utils/stringUtils';

describe('capitalizeWords', () => {
  it('should capitalize the first letter of each word', () => {
    expect(capitalizeWords('hello world')).toBe('Hello World');
  });

  it('should handle single word', () => {
    expect(capitalizeWords('hello')).toBe('Hello');
  });

  it('should handle empty string', () => {
    expect(capitalizeWords('')).toBe('');
  });

  it('should handle multiple spaces between words', () => {
    expect(capitalizeWords('hello   world')).toBe('Hello   World');
  });

  it('should handle already capitalized words', () => {
    expect(capitalizeWords('Hello World')).toBe('Hello World');
  });

  it('should handle mixed case words', () => {
    expect(capitalizeWords('hELLo WoRLd')).toBe('Hello World');
  });
});