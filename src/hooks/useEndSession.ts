import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import useAuthStore from '../stores/authStore';

// Drops everything that belongs to the session of this tab: the store, the
// cached server data (so the next user never sees it) and the protected page.
export function useEndSession() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(() => {
    clearSession();
    queryClient.clear();
    navigate('/login', { replace: true });
  }, [clearSession, queryClient, navigate]);
}
