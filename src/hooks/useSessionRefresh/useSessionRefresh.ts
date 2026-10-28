import { useEffect } from 'react';
import { refreshSession } from '../../lib/authApi';
import { broadcastRefresh, listenForRefresh } from '../../lib/sessionChannel';
import useAuthStore from '../../stores/authStore';
import { useEndSession } from '../useEndSession/useEndSession';
import { useExpireSession } from '../useExpireSession/useExpireSession';

// Renew this long before the access token expires, so a slow request does not
// let it lapse.
const RENEW_MARGIN_MS = 60_000;
// After a network error or a 5xx the session is still fine: try again soon.
const RETRY_DELAY_MS = 15_000;
// setTimeout stores its delay in 32 bits: a longer one fires immediately.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
// Capture, because scroll events do not bubble up from scrollable elements.
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;
const LISTENER_OPTIONS = { capture: true, passive: true };

// Keeps an active user signed in: shortly before the access token expires it
// asks the API for a new one (which also rotates the refresh cookie). A user
// with no activity since the last renewal is not renewed, so the session lapses
// and they are taken to the login. Coming back before it lapses renews it.
export function useSessionRefresh() {
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const setExpiresAt = useAuthStore((state) => state.setExpiresAt);
  const endSession = useEndSession();
  const expireSession = useExpireSession();

  useEffect(() => listenForRefresh(setExpiresAt), [setExpiresAt]);

  useEffect(() => {
    if (expiresAt === null) {
      return;
    }

    const expiresAtMs = expiresAt * 1000;
    const renewAt = expiresAtMs - RENEW_MARGIN_MS;
    let timer: ReturnType<typeof setTimeout>;
    let isStopped = false;
    let isRefreshing = false;
    // Activity since the last renewal: the effect restarts on every new expiry.
    let wasActive = false;
    let isWaitingForActivity = false;

    async function refresh() {
      if (isRefreshing) {
        return;
      }
      isRefreshing = true;
      const result = await refreshSession();
      isRefreshing = false;
      if (isStopped) {
        return;
      }

      if (result.ok) {
        // Restarts this effect with the new expiry.
        setExpiresAt(result.expiresAt);
        broadcastRefresh(result.expiresAt);
      } else if (result.reason === 'no-session') {
        endSession('expired');
      } else {
        timer = setTimeout(refresh, RETRY_DELAY_MS);
      }
    }

    function onRenewalDue() {
      if (wasActive) {
        void refresh();
        return;
      }
      isWaitingForActivity = true;
      timer = setTimeout(expireSession, Math.max(expiresAtMs - Date.now(), 0));
    }

    function waitForRenewal() {
      const remaining = renewAt - Date.now();
      timer =
        remaining > MAX_TIMEOUT_MS
          ? setTimeout(waitForRenewal, MAX_TIMEOUT_MS)
          : setTimeout(onRenewalDue, Math.max(remaining, 0));
    }

    function onActivity() {
      wasActive = true;
      if (isWaitingForActivity) {
        isWaitingForActivity = false;
        clearTimeout(timer);
        void refresh();
      }
    }

    waitForRenewal();
    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, onActivity, LISTENER_OPTIONS),
    );

    return () => {
      isStopped = true;
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) =>
        window.removeEventListener(name, onActivity, LISTENER_OPTIONS),
      );
    };
  }, [expiresAt, setExpiresAt, endSession, expireSession]);
}
