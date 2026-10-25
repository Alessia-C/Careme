// Navigation state that tells the login page the user was just signed out, so
// it can say so and move focus there (the Logout button no longer exists).
export const SIGNED_OUT_STATE = { signedOut: true };

export function isSignedOutState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'signedOut' in state &&
    state.signedOut === true
  );
}
