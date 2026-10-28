const SESSION_CHANNEL = 'careme-session';

// Best effort, like the logout channel: browsers without BroadcastChannel
// simply never tell the other tabs.
const isSupported = () => typeof BroadcastChannel !== 'undefined';

// The cookies are shared by every tab of the browser, so when one tab renews
// the session the others must learn the new expiry. Otherwise an idle tab
// would end its session at the old expiry although the session is still valid.
// A BroadcastChannel never delivers to the tab that sent it.
export function broadcastRefresh(expiresAt: number) {
  if (!isSupported()) {
    return;
  }
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.postMessage(expiresAt);
  channel.close();
}

// Calls onRefresh with the new expiry when another tab renews the session.
// Returns the function that stops listening.
export function listenForRefresh(onRefresh: (expiresAt: number) => void) {
  if (!isSupported()) {
    return () => {};
  }
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.onmessage = (event) => {
    if (typeof event.data === 'number') {
      onRefresh(event.data);
    }
  };
  return () => channel.close();
}
