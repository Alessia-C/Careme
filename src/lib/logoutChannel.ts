const LOGOUT_CHANNEL = 'careme-auth';
const LOGOUT_MESSAGE = 'logout';
// Same as above, but the request to the API did not reach the server.
const LOGOUT_UNCONFIRMED_MESSAGE = 'logout-unconfirmed';

// Best effort: browsers without BroadcastChannel simply never tell the other
// tabs, which discover the logout on their next request.
const isSupported = () => typeof BroadcastChannel !== 'undefined';

// Tells the other tabs of this browser that the user logged out. The message
// carries no data. A BroadcastChannel never delivers to the tab that sent it.
export function broadcastLogout(confirmed = true) {
  if (!isSupported()) {
    return;
  }
  const channel = new BroadcastChannel(LOGOUT_CHANNEL);
  channel.postMessage(confirmed ? LOGOUT_MESSAGE : LOGOUT_UNCONFIRMED_MESSAGE);
  channel.close();
}

// Calls onLogout when another tab logs out, saying whether the server
// confirmed it. Returns the function that stops listening.
export function listenForLogout(onLogout: (confirmed: boolean) => void) {
  if (!isSupported()) {
    return () => {};
  }
  const channel = new BroadcastChannel(LOGOUT_CHANNEL);
  channel.onmessage = (event) => {
    if (event.data === LOGOUT_MESSAGE) {
      onLogout(true);
    } else if (event.data === LOGOUT_UNCONFIRMED_MESSAGE) {
      onLogout(false);
    }
  };
  return () => channel.close();
}
