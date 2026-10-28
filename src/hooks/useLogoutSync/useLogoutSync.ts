import { useEffect } from 'react';
import { listenForLogout } from '../../lib/logoutChannel';
import { useEndSession } from '../useEndSession/useEndSession';

// Ends this tab's session when another tab logs out.
export function useLogoutSync() {
  const endSession = useEndSession();

  useEffect(() => listenForLogout(endSession), [endSession]);
}
