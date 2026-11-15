import { describe, expect, it } from 'vitest';
import { getUserFullName, getUserInitials } from './userInitials';

const email = 'jane@example.com';

describe('getUserInitials', () => {
  it('uses the first letter of the first and the last name, in uppercase', () => {
    expect(getUserInitials({ firstName: 'jane', lastName: 'doe', email })).toBe(
      'JD',
    );
  });

  it('shows a single initial when the last name is empty', () => {
    expect(getUserInitials({ firstName: 'Jane', lastName: '', email })).toBe(
      'J',
    );
  });

  it('shows a single initial when the first name is empty', () => {
    expect(getUserInitials({ firstName: '', lastName: 'Doe', email })).toBe(
      'D',
    );
  });

  it('falls back to the first letter of the email when both names are empty', () => {
    expect(getUserInitials({ firstName: '', lastName: '', email })).toBe('J');
  });

  it('ignores leading spaces and treats blank names as empty', () => {
    expect(
      getUserInitials({ firstName: '  Jane', lastName: '   ', email }),
    ).toBe('J');
  });

  it('keeps accented letters whole', () => {
    expect(
      getUserInitials({ firstName: 'Émilie', lastName: 'Ørsted', email }),
    ).toBe('ÉØ');
  });

  it('takes a full code point for characters outside the Latin alphabet', () => {
    expect(getUserInitials({ firstName: '李', lastName: '明', email })).toBe(
      '李明',
    );
  });
});

describe('getUserFullName', () => {
  it('joins the first and the last name', () => {
    expect(getUserFullName({ firstName: 'Jane', lastName: 'Doe', email })).toBe(
      'Jane Doe',
    );
  });

  it('uses only the name that is set', () => {
    expect(getUserFullName({ firstName: 'Jane', lastName: '', email })).toBe(
      'Jane',
    );
  });

  it('falls back to the email when no name is set', () => {
    expect(getUserFullName({ firstName: ' ', lastName: '', email })).toBe(
      email,
    );
  });
});
