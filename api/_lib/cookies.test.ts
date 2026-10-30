import { describe, expect, it } from 'vitest';
import { getCookie } from './cookies.js';
import { makeReq } from './test-helpers.js';

describe('getCookie', () => {
  it('should return the value of the named cookie', () => {
    const req = makeReq('GET', undefined, { cookie: 'a=1; b=2' });

    expect(getCookie(req, 'b')).toBe('2');
  });

  it('should return undefined when there is no Cookie header', () => {
    expect(getCookie(makeReq('GET'), 'a')).toBeUndefined();
  });

  it('should return undefined for an empty value', () => {
    const req = makeReq('GET', undefined, { cookie: 'a=' });

    expect(getCookie(req, 'a')).toBeUndefined();
  });

  it('should let the first of two duplicated names win', () => {
    const req = makeReq('GET', undefined, { cookie: 'a=first; a=second' });

    expect(getCookie(req, 'a')).toBe('first');
  });

  it('should decode percent-encoded values', () => {
    const req = makeReq('GET', undefined, { cookie: 'a=x%20y' });

    expect(getCookie(req, 'a')).toBe('x y');
  });

  it('should ignore a malformed percent-escape instead of throwing', () => {
    const req = makeReq('GET', undefined, { cookie: 'a=%E0%A4%A' });

    expect(getCookie(req, 'a')).toBeUndefined();
  });

  it('should not read inherited properties such as __proto__', () => {
    const req = makeReq('GET', undefined, { cookie: 'a=1' });

    expect(getCookie(req, '__proto__')).toBeUndefined();
  });

  it('should ignore a pair without "="', () => {
    const req = makeReq('GET', undefined, { cookie: 'junk; a=1' });

    expect(getCookie(req, 'a')).toBe('1');
  });
});
