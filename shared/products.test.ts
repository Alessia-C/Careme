import { describe, it, expect } from 'vitest';
import {
  isCategory,
  isCategoryFilter,
  isProductStatus,
  isUuid,
} from './products';

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

describe('isCategoryFilter', () => {
  it.each(['skincare', 'makeup', 'all'])(
    'should return true for %s',
    (value) => {
      expect(isCategoryFilter(value)).toBe(true);
    },
  );

  it.each([
    ['an unknown value', 'perfume'],
    ['a different case', 'All'],
    ['an empty string', ''],
    ['undefined', undefined],
  ])('should return false for %s', (_reason, value) => {
    expect(isCategoryFilter(value)).toBe(false);
  });
});

describe('isUuid', () => {
  it.each([
    ['lowercase', '123e4567-e89b-42d3-a456-426614174000'],
    ['uppercase', '123E4567-E89B-42D3-A456-426614174000'],
  ])('should return true for a %s uuid', (_reason, value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    ['text', 'abc'],
    ['an empty string', ''],
    ['a uuid without dashes', '123e4567e89b42d3a456426614174000'],
    [
      'a uuid with a trailing character',
      '123e4567-e89b-42d3-a456-4266141740000',
    ],
    ['a number', 42],
    ['undefined', undefined],
  ])('should return false for %s', (_reason, value) => {
    expect(isUuid(value)).toBe(false);
  });
});
