import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  SESSION_EXPIRED_STATE,
  SIGN_OUT_UNCONFIRMED_STATE,
  SIGNED_OUT_STATE,
  type SignOutNotice,
} from '../../lib/signedOut';
import useAuthStore from '../../stores/authStore';

const NAVIGATION_STATE: Record<SignOutNotice, object> = {
  'signed-out': SIGNED_OUT_STATE,
  unconfirmed: SIGN_OUT_UNCONFIRMED_STATE,
  expired: SESSION_EXPIRED_STATE,
};

// Drops everything that belongs to the session of this tab: the store, the
// cached server data (so the next user never sees it) and the protected page.
export function useEndSession() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // The reason tells the login page what to say. `unconfirmed` means the
  // server could not be reached: the page warns that the cookie may still be
  // there.
  return useCallback(
    (reason: SignOutNotice = 'signed-out') => {
      clearSession();
      queryClient.clear();
      navigate('/login', {
        replace: true,
        state: NAVIGATION_STATE[reason],
      });
    },
    [clearSession, queryClient, navigate],
  );
}
