// Navigation state that tells the login page the user was just signed out, so
// it can say so and move focus there (the Logout button no longer exists).
// `confirmed` is false when the logout request did not reach the server: the
// local session is gone but the cookie may still be in the browser. `expired`
// is a session that lapsed (idle user, or the API answered 401).
export type SignOutNotice = 'signed-out' | 'unconfirmed' | 'expired';

export const SIGNED_OUT_STATE = { signedOut: true, confirmed: true };
export const SIGN_OUT_UNCONFIRMED_STATE = {
  signedOut: true,
  confirmed: false,
};

export const SESSION_EXPIRED_STATE = { signedOut: true, expired: true };

export function getSignOutNotice(state: unknown): SignOutNotice | null {
  if (
    typeof state !== 'object' ||
    state === null ||
    !('signedOut' in state) ||
    state.signedOut !== true
  ) {
    return null;
  }
  if ('expired' in state && state.expired === true) {
    return 'expired';
  }
  return 'confirmed' in state && state.confirmed === false
    ? 'unconfirmed'
    : 'signed-out';
}
