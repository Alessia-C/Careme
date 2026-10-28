import type { SignOutNotice } from './signedOut';

const LOGOUT_CHANNEL = 'careme-auth';
// One message per reason, so the other tabs show the same notice. The message
// carries no other data.
const MESSAGES: Record<SignOutNotice, string> = {
  'signed-out': 'logout',
  // The request to the API did not reach the server.
  unconfirmed: 'logout-unconfirmed',
  expired: 'session-expired',
};

// Best effort: browsers without BroadcastChannel simply never tell the other
// tabs, which discover the logout on their next request.
const isSupported = () => typeof BroadcastChannel !== 'undefined';

// Tells the other tabs of this browser that the session ended. A
// BroadcastChannel never delivers to the tab that sent it.
export function broadcastLogout(reason: SignOutNotice = 'signed-out') {
  if (!isSupported()) {
    return;
  }
  const channel = new BroadcastChannel(LOGOUT_CHANNEL);
  channel.postMessage(MESSAGES[reason]);
  channel.close();
}

// Calls onLogout when another tab ends the session, saying why. Returns the
// function that stops listening.
export function listenForLogout(onLogout: (reason: SignOutNotice) => void) {
  if (!isSupported()) {
    return () => {};
  }
  const channel = new BroadcastChannel(LOGOUT_CHANNEL);
  channel.onmessage = (event) => {
    const reason = (Object.keys(MESSAGES) as SignOutNotice[]).find(
      (key) => MESSAGES[key] === event.data,
    );
    if (reason) {
      onLogout(reason);
    }
  };
  return () => channel.close();
}
