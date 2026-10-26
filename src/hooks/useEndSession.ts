import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { SIGN_OUT_UNCONFIRMED_STATE, SIGNED_OUT_STATE } from '../lib/signedOut';
import useAuthStore from '../stores/authStore';

// Drops everything that belongs to the session of this tab: the store, the
// cached server data (so the next user never sees it) and the protected page.
export function useEndSession() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // `confirmed` is false when the server could not be reached: the login page
  // then warns that the cookie may still be there.
  return useCallback(
    (confirmed = true) => {
      clearSession();
      queryClient.clear();
      navigate('/login', {
        replace: true,
        state: confirmed ? SIGNED_OUT_STATE : SIGN_OUT_UNCONFIRMED_STATE,
      });
    },
    [clearSession, queryClient, navigate],
  );
}
