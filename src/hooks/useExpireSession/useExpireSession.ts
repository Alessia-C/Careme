import { useCallback, useRef } from 'react';
import { logout } from '../../lib/authApi';
import { broadcastLogout } from '../../lib/logoutChannel';
import { useEndSession } from '../useEndSession/useEndSession';

// Ends a session that lapsed. A plain redirect would leave the refresh cookie
// in the browser (and the session valid on Supabase) for whoever uses the
// device next: logging out clears it and revokes the session, like the Logout
// button does. If the server cannot be reached the login page warns about it
// instead of saying the session simply expired.
export function useExpireSession() {
  const endSession = useEndSession();
  // Several requests can fail with 401 together: end the session only once.
  const isExpiring = useRef(false);

  return useCallback(async () => {
    if (isExpiring.current) {
      return;
    }
    isExpiring.current = true;
    try {
      const { ok } = await logout();
      const reason = ok ? 'expired' : 'unconfirmed';
      endSession(reason);
      broadcastLogout(reason);
    } finally {
      isExpiring.current = false;
    }
  }, [endSession]);
}
