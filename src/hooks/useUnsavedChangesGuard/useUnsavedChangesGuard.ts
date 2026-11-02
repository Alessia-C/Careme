import { useEffect } from 'react';
import { useBlocker } from 'react-router';

// Where the app sends the user when the session ends. Leaving there is not a
// choice of the user, so it must never wait for an answer.
const LOGIN_PATH = '/login';

// While `isActive`, leaving the page needs the user's answer: a navigation
// inside the app (e.g. the Back button) is held until `proceed` or `stay`,
// and closing or reloading the tab gets the browser's own warning.
export function useUnsavedChangesGuard(isActive: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isActive &&
      currentLocation.pathname !== nextLocation.pathname &&
      nextLocation.pathname !== LOGIN_PATH,
  );

  useEffect(() => {
    if (!isActive) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isActive]);

  return {
    isBlocked: blocker.state === 'blocked',
    proceed: () => blocker.proceed?.(),
    stay: () => blocker.reset?.(),
  };
}
