import { describe, expect, it } from 'vitest';
import {
  getSignOutNotice,
  SIGN_OUT_UNCONFIRMED_STATE,
  SIGNED_OUT_STATE,
} from './signedOut';

describe('getSignOutNotice', () => {
  it('recognizes the state set after a confirmed logout', () => {
    expect(getSignOutNotice(SIGNED_OUT_STATE)).toBe('signed-out');
  });

  it('recognizes the state set when the logout was not confirmed', () => {
    expect(getSignOutNotice(SIGN_OUT_UNCONFIRMED_STATE)).toBe('unconfirmed');
  });

  it('treats a state without `confirmed` as a confirmed logout', () => {
    expect(getSignOutNotice({ signedOut: true })).toBe('signed-out');
  });

  it.each([null, undefined, 'signedOut', {}, { signedOut: 'yes' }])(
    'rejects %j',
    (state) => {
      expect(getSignOutNotice(state)).toBeNull();
    },
  );
});
