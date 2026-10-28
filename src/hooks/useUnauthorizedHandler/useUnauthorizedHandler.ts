import { useEffect } from 'react';
import { setUnauthorizedHandler } from '../../lib/unauthorized';
import { useExpireSession } from '../useExpireSession/useExpireSession';

// Sends the user to the login when a protected endpoint answers 401.
export function useUnauthorizedHandler() {
  const expireSession = useExpireSession();

  useEffect(
    () => setUnauthorizedHandler(() => void expireSession()),
    [expireSession],
  );
}
