import { describe, expect, it } from 'vitest';
import { isSignedOutState, SIGNED_OUT_STATE } from './signedOut';

describe('isSignedOutState', () => {
  it('recognizes the state set after a logout', () => {
    expect(isSignedOutState(SIGNED_OUT_STATE)).toBe(true);
  });

  it.each([null, undefined, 'signedOut', {}, { signedOut: 'yes' }])(
    'rejects %j',
    (state) => {
      expect(isSignedOutState(state)).toBe(false);
    },
  );
});
