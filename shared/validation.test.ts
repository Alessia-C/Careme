import { describe, it, expect } from 'vitest';
import {
  isObject,
  normalizeEmail,
  validateEmail,
  validateInput,
  validatePassword,
} from './validation';

describe('validation password', () => {
  it.each([
    ['a typical password', 'Valid123!'],
    ['exactly 8 characters', 'Valid12!'],
    ['exactly 20 characters', 'Valid123!Valid123!aA'],
  ])('should return true for a password with %s', (_reason, password) => {
    const result = validatePassword(password);
    expect(result).toBe(true);
  });

  it.each([
    ['too short', 'Short1!'],
    ['too long (21 characters)', 'Valid123!Valid123!aAb'],
    ['no uppercase', 'nouppercase1!'],
    ['no lowercase', 'NOLOWERCASE1!'],
    ['no number', 'NoNumber!'],
    ['no special character', 'NoSpecial1'],
    ['an empty string', ''],
  ])('should return false for a password that is %s', (_reason, password) => {
    const result = validatePassword(password);
    expect(result).toBe(false);
  });
});

describe('validation input', () => {
  it('should return true for a non-empty input', () => {
    const input = 'Non-empty input';
    const result = validateInput(input);
    expect(result).toBe(true);
  });

  it.each([
    ['an empty string', ''],
    ['only spaces', '   '],
    ['only tabs and newlines', '\t\n'],
  ])('should return false for %s', (_reason, input) => {
    const result = validateInput(input);
    expect(result).toBe(false);
  });
});

describe('validation email', () => {
  it.each([
    ['a plain email', 'valid@example.com'],
    ['surrounding spaces', '  valid@example.com  '],
    ['uppercase letters', 'Valid@Example.COM'],
  ])('should return true for an email with %s', (_reason, email) => {
    const result = validateEmail(email);
    expect(result).toBe(true);
  });

  it.each([
    ['no @', 'invalid-email'],
    ['an empty string', ''],
    ['only spaces', '   '],
    ['no local part', '@example.com'],
    ['no domain', 'user@'],
    ['no dot in the domain', 'user@example'],
    ['a space inside', 'us er@example.com'],
    ['two @', 'user@@example.com'],
  ])('should return false for an email with %s', (_reason, email) => {
    const result = validateEmail(email);
    expect(result).toBe(false);
  });
});

describe('validation normalizeEmail', () => {
  it.each([
    ['uppercase letters', 'Test@Example.COM', 'test@example.com'],
    ['surrounding spaces', '  test@example.com ', 'test@example.com'],
    ['an already normalized email', 'test@example.com', 'test@example.com'],
  ])('should normalize %s', (_reason, input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});

describe('validation isObject', () => {
  it.each([
    ['an object with fields', { email: 'a@b.it' }],
    ['an empty object', {}],
    // Arrays are objects for typeof: the check only guards against
    // null and primitives, so this documents the current behavior.
    ['an array', []],
  ])('should return true for %s', (_reason, value) => {
    const result = isObject(value);
    expect(result).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'text'],
    ['a number', 42],
    ['a boolean', true],
  ])('should return false for %s', (_reason, value) => {
    const result = isObject(value);
    expect(result).toBe(false);
  });
});
