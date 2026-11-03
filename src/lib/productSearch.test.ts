import { describe, expect, it } from 'vitest';
import { getSearchError } from './productSearch';

describe('getSearchError', () => {
  it.each(['', 'serum', 'Eye Palette', '  mac  ', 'Crème'])(
    'accepts "%s"',
    (term) => {
      expect(getSearchError(term)).toBeNull();
    },
  );

  it.each(['50%', 'a_b', 'a\\b', 'a*b', 'a"b', 'a,b', 'Serum (30ml)', 'a)b'])(
    'rejects "%s" for its forbidden character',
    (term) => {
      expect(getSearchError(term)).toBe('Search contains invalid characters');
    },
  );

  it('rejects a NUL character', () => {
    expect(getSearchError('a\u0000b')).toBe(
      'Search contains invalid characters',
    );
  });

  it('accepts 100 characters and rejects 101', () => {
    expect(getSearchError('a'.repeat(100))).toBeNull();
    expect(getSearchError('a'.repeat(101))).toBe(
      'Search is too long (max 100 characters)',
    );
  });

  it('measures the length after trimming, like the API', () => {
    expect(getSearchError(`  ${'a'.repeat(100)}  `)).toBeNull();
  });
});
