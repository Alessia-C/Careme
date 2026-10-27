import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import Loader from '../components/Loader/Loader';
import { fetchSession } from '../lib/authApi';
import useAuthStore from '../stores/authStore';
import styles from './SessionRestore.module.css';

// Root of every route. After a page reload the in-memory store is empty even
// though the session cookie may still be valid, so nothing is rendered until
// GET /api/auth/me says who the user is. Without the wait, ProtectedRoute
// would send a logged-in user to /login on every reload.
function SessionRestore() {
  const restoreStatus = useAuthStore((state) => state.restoreStatus);
  const setSession = useAuthStore((state) => state.setSession);
  const setRestoreStatus = useAuthStore((state) => state.setRestoreStatus);

  // The store flag, not the query data, decides when to stop: logout clears
  // the React Query cache and must not trigger a second restore. fetchSession
  // never throws, so the "no session" and "failed" outcomes arrive as data.
  const { data } = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    enabled: restoreStatus === 'pending',
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!data) {
      return;
    }
    if (data.ok) {
      setSession(data.user, data.role, data.expiresAt);
      setRestoreStatus('restored');
    } else {
      // Without a session ProtectedRoute redirects to /login, which shows the
      // warning when the cause was a failure.
      setRestoreStatus(data.reason === 'failed' ? 'failed' : 'restored');
    }
  }, [data, setSession, setRestoreStatus]);

  if (restoreStatus === 'pending') {
    // The status text is visually hidden: the spinner is the visible cue.
    return (
      <main className={styles.loading}>
        <Loader />
        <p role="status" className={styles.status}>
          Loading
        </p>
      </main>
    );
  }

  return <Outlet />;
}

export default SessionRestore;
