import { describe, expect, it } from 'vitest';
import {
  PASSWORD_POLICY_MESSAGE,
  SAME_PASSWORD_MESSAGE,
} from '../../shared/validation.js';
import { parseAccountInput, parsePasswordInput } from './_validation.js';

const validBody = { first_name: 'Anna', last_name: 'Rossi' };
const fieldsMessage = 'Only first_name and last_name can be updated';

describe('parseAccountInput', () => {
  it('should return the names', () => {
    expect(parseAccountInput(validBody)).toEqual({
      ok: true,
      value: validBody,
    });
  });

  it('should trim the names', () => {
    const result = parseAccountInput({
      first_name: '  Anna ',
      last_name: ' Rossi  ',
    });

    expect(result).toEqual({ ok: true, value: validBody });
  });

  it('should accept names of 50 characters', () => {
    const name = 'a'.repeat(50);

    const result = parseAccountInput({ first_name: name, last_name: name });

    expect(result.ok).toBe(true);
  });

  it.each([
    'email',
    'role',
    'status',
    'id',
    'created_at',
    'firstName',
    'anything',
  ])('should refuse a body with the field %s', (field) => {
    const result = parseAccountInput({ ...validBody, [field]: 'value' });

    expect(result).toEqual({ ok: false, message: fieldsMessage });
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a number', 42],
    ['empty', ''],
    ['blank', '   '],
    ['51 characters long', 'a'.repeat(51)],
    ['holding a NUL character', 'a\u0000b'],
  ])('should refuse a first or last name that is %s', (_reason, value) => {
    expect(parseAccountInput({ ...validBody, first_name: value })).toEqual({
      ok: false,
      message: 'First name is required (max 50 characters)',
    });
    expect(parseAccountInput({ ...validBody, last_name: value })).toEqual({
      ok: false,
      message: 'Last name is required (max 50 characters)',
    });
  });
});

describe('parsePasswordInput', () => {
  const validPasswords = {
    current_password: 'Current123!',
    new_password: 'Valid123!',
    confirm_password: 'Valid123!',
  };

  it('should return the two passwords without the confirmation', () => {
    expect(parsePasswordInput(validPasswords)).toEqual({
      ok: true,
      value: { current_password: 'Current123!', new_password: 'Valid123!' },
    });
  });

  it('should not trim the passwords', () => {
    const result = parsePasswordInput({
      current_password: '  old ',
      new_password: ' Valid123! ',
      confirm_password: ' Valid123! ',
    });

    expect(result).toEqual({
      ok: true,
      value: { current_password: '  old ', new_password: ' Valid123! ' },
    });
  });

  // The current password may be older than the policy.
  it('should not apply the policy to the current password', () => {
    const result = parsePasswordInput({
      ...validPasswords,
      current_password: 'weak',
    });

    expect(result.ok).toBe(true);
  });

  const requiredMessage = 'Current password is required';
  const mismatchMessage = 'Password confirmation does not match';

  it.each([
    [
      'an unknown field',
      { email: 'other@example.com' },
      'Only current_password, new_password and confirm_password are accepted',
    ],
    ['no current password', { current_password: undefined }, requiredMessage],
    ['an empty current password', { current_password: '' }, requiredMessage],
    [
      'a current password that is not a string',
      { current_password: 12345 },
      requiredMessage,
    ],
    ['no new password', { new_password: undefined }, PASSWORD_POLICY_MESSAGE],
    [
      'a new password that is not a string',
      { new_password: 12345 },
      PASSWORD_POLICY_MESSAGE,
    ],
    [
      'a weak new password',
      { new_password: 'weak', confirm_password: 'weak' },
      PASSWORD_POLICY_MESSAGE,
    ],
    ['no confirmation', { confirm_password: undefined }, mismatchMessage],
    [
      'a different confirmation',
      { confirm_password: 'Valid123?' },
      mismatchMessage,
    ],
    [
      'a new password equal to the current one',
      { current_password: 'Valid123!' },
      SAME_PASSWORD_MESSAGE,
    ],
  ])('should refuse %s', (_label, override, message) => {
    const result = parsePasswordInput({ ...validPasswords, ...override });

    expect(result).toEqual({ ok: false, message });
  });
});
