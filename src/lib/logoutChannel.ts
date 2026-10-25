const LOGOUT_CHANNEL = 'careme-auth';
const LOGOUT_MESSAGE = 'logout';

// Best effort: browsers without BroadcastChannel simply never tell the other
// tabs, which discover the logout on their next request.
const isSupported = () => typeof BroadcastChannel !== 'undefined';

// Tells the other tabs of this browser that the user logged out. The message
// carries no data. A BroadcastChannel never delivers to the tab that sent it.
export function broadcastLogout() {
  if (!isSupported()) {
    return;
  }
  const channel = new BroadcastChannel(LOGOUT_CHANNEL);
  channel.postMessage(LOGOUT_MESSAGE);
  channel.close();
}

// Calls onLogout when another tab logs out. Returns the function that stops
// listening.
export function listenForLogout(onLogout: () => void) {
  if (!isSupported()) {
    return () => {};
  }
  const channel = new BroadcastChannel(LOGOUT_CHANNEL);
  channel.onmessage = (event) => {
    if (event.data === LOGOUT_MESSAGE) {
      onLogout();
    }
  };
  return () => channel.close();
}
