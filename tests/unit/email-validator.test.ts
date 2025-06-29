import { isValidEmail } from '../../src/utils';

describe('isValidEmail', () => {
  test('should return true for valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('john.doe@company.co.uk')).toBe(true);
    expect(isValidEmail('test+tag@subdomain.example.com')).toBe(true);
    expect(isValidEmail('123@example.com')).toBe(true);
  });

  test('should return false for invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@@example.com')).toBe(false);
    expect(isValidEmail('user@example')).toBe(false);
    expect(isValidEmail('user example@test.com')).toBe(false);
  });

  test('should handle edge cases', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
    expect(isValidEmail(123 as any)).toBe(false);
  });

  test('should handle special characters correctly', () => {
    expect(isValidEmail('user.name@example.com')).toBe(true);
    expect(isValidEmail('user_name@example.com')).toBe(true);
    expect(isValidEmail('user-name@example.com')).toBe(true);
    expect(isValidEmail('user#name@example.com')).toBe(false);
    expect(isValidEmail('user@name@example.com')).toBe(false);
  });
});