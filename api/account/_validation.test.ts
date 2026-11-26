import { describe, expect, it } from 'vitest';
import { parseAccountInput } from './_validation.js';

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
