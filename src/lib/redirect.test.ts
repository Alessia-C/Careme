import { describe, expect, it } from 'vitest';
import { getSafeNextPath } from './redirect';

describe('getSafeNextPath', () => {
  it.each(['/', '/products', '/products?page=2', '/a/b#top'])(
    'keeps the internal path %s',
    (next) => {
      expect(getSafeNextPath(next)).toBe(next);
    },
  );

  it.each([
    ['missing', null],
    ['empty', ''],
    ['an absolute URL', 'https://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['backslash host', '/\\evil.example'],
    ['a relative path', 'products'],
    ['a javascript URL', 'javascript:alert(1)'],
  ])('falls back to / when next is %s', (_label, next) => {
    expect(getSafeNextPath(next)).toBe('/');
  });
});
