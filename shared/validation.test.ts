import { describe, it, expect } from 'vitest';
import {
  PASSWORD_POLICY_MESSAGE,
  hasNulCharacter,
  isObject,
  normalizeEmail,
  profileNameError,
  readText,
  validateEmail,
  validateInput,
  validatePassword,
} from './validation';

describe('password policy message', () => {
  it('should state the limits that validatePassword enforces', () => {
    expect(PASSWORD_POLICY_MESSAGE).toBe(
      'Invalid password: use 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character',
    );
  });
});

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

describe('validation hasNulCharacter', () => {
  it('should return true when the text contains a NUL character', () => {
    expect(hasNulCharacter('a\u0000b')).toBe(true);
  });

  it.each(['', 'plain text', 'àèì ✓'])(
    'should return false for "%s"',
    (value) => {
      expect(hasNulCharacter(value)).toBe(false);
    },
  );
});

describe('validation readText', () => {
  it('should return the trimmed text', () => {
    expect(readText('  Anna ', 10)).toBe('Anna');
  });

  it('should apply the limit after trimming', () => {
    expect(readText('  abc  ', 3)).toBe('abc');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['empty', ''],
    ['blank', '   '],
    ['over the limit', 'abcd'],
    ['with a NUL character', 'a\u0000b'],
  ])('should return undefined when the value is %s', (_reason, value) => {
    expect(readText(value, 3)).toBeUndefined();
  });
});

describe('validation profileNameError', () => {
  it('should name the field and the limit', () => {
    expect(profileNameError('Last name')).toBe(
      'Last name is required (max 50 characters)',
    );
  });
});
