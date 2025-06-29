import { add } from '../../src/utils/calculator';

describe('Calculator', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      const result = add(2, 3);
      expect(result).toBe(5);
    });

    it('should add negative numbers', () => {
      const result = add(-2, -3);
      expect(result).toBe(-5);
    });

    it('should add positive and negative numbers', () => {
      const result = add(5, -3);
      expect(result).toBe(2);
    });

    it('should handle zero', () => {
      expect(add(0, 5)).toBe(5);
      expect(add(5, 0)).toBe(5);
      expect(add(0, 0)).toBe(0);
    });

    it('should handle decimal numbers', () => {
      const result = add(0.1, 0.2);
      expect(result).toBeCloseTo(0.3);
    });
  });
});