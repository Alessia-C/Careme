import { describe, expect, it } from 'vitest';
import { parseProductInput } from './_validation.js';

const validBody = {
  name: 'Hydrating Cream',
  brand: 'CeraVe',
  category: 'skincare',
  status: 'new',
  note: 'Bought in May',
};

describe('parseProductInput', () => {
  it('should return the values to save for a valid body', () => {
    expect(parseProductInput(validBody)).toEqual({
      ok: true,
      value: validBody,
    });
  });

  it('should return only the whitelisted fields, dropping the others', () => {
    const result = parseProductInput({
      ...validBody,
      id: 'forged-id',
      user_id: 'someone-else',
      created_at: '2000-01-01T00:00:00Z',
    });

    expect(result).toEqual({ ok: true, value: validBody });
  });

  it('should trim name, brand and note', () => {
    const result = parseProductInput({
      ...validBody,
      name: '  Hydrating Cream ',
      brand: ' CeraVe  ',
      note: '  Bought in May ',
    });

    expect(result).toEqual({ ok: true, value: validBody });
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['blank', '   '],
  ])('should turn a %s note into null', (_reason, note) => {
    expect(parseProductInput({ ...validBody, note })).toEqual({
      ok: true,
      value: { ...validBody, note: null },
    });
  });

  it('should accept values exactly at the length limits', () => {
    const result = parseProductInput({
      ...validBody,
      name: 'a'.repeat(100),
      brand: 'b'.repeat(100),
      note: 'c'.repeat(500),
    });

    expect(result.ok).toBe(true);
  });

  it.each([
    ['name is missing', { name: undefined }, 'Name is required'],
    ['name is blank', { name: '   ' }, 'Name is required'],
    ['name is not a string', { name: 42 }, 'Name is required'],
    ['name is too long', { name: 'a'.repeat(101) }, 'Name is required'],
    ['brand is missing', { brand: undefined }, 'Brand is required'],
    ['brand is empty', { brand: '' }, 'Brand is required'],
    ['brand is blank', { brand: '   ' }, 'Brand is required'],
    ['brand is too long', { brand: 'a'.repeat(101) }, 'Brand is required'],
    ['category is missing', { category: undefined }, 'Category must be'],
    ['category is unknown', { category: 'perfume' }, 'Category must be'],
    ['status is missing', { status: undefined }, 'Status must be'],
    ['status is unknown', { status: 'open' }, 'Status must be'],
    ['note is not a string', { note: 5 }, 'Note must be a string'],
    ['note is too long', { note: 'a'.repeat(501) }, 'Note is too long'],
    ['name has a NUL character', { name: 'a\u0000b' }, 'Name is required'],
    ['brand has a NUL character', { brand: 'a\u0000b' }, 'Brand is required'],
    ['note has a NUL character', { note: 'a\u0000b' }, 'Note contains'],
  ])('should reject the body when %s', (_reason, override, message) => {
    const result = parseProductInput({ ...validBody, ...override });

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining(message),
    });
  });
});
