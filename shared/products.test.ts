import { describe, it, expect } from 'vitest';
import { isCategory, isProductStatus } from './products';

describe('isCategory', () => {
  it.each(['skincare', 'makeup'])('should return true for %s', (value) => {
    expect(isCategory(value)).toBe(true);
  });

  it.each([
    ['an unknown value', 'perfume'],
    ['a different case', 'Skincare'],
    ['an empty string', ''],
    ['a number', 42],
    ['undefined', undefined],
    ['null', null],
  ])('should return false for %s', (_reason, value) => {
    expect(isCategory(value)).toBe(false);
  });
});

describe('isProductStatus', () => {
  it.each(['new', 'used', 'finished'])('should return true for %s', (value) => {
    expect(isProductStatus(value)).toBe(true);
  });

  it.each([
    ['an unknown value', 'open'],
    ['a different case', 'New'],
    ['an empty string', ''],
    ['a number', 1],
    ['undefined', undefined],
    ['null', null],
  ])('should return false for %s', (_reason, value) => {
    expect(isProductStatus(value)).toBe(false);
  });
});
