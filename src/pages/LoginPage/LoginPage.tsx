import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import AuthLayout from '../../components/AuthLayout/AuthLayout';
import Feedback from '../../components/Feedback/Feedback';
import { isAuthenticated } from '../../lib/auth';
import useAuthStore from '../../stores/authStore';
import { getSignOutNotice, type SignOutNotice } from '../../lib/signedOut';
import LoginForm from './components/LoginForm/LoginForm';
import styles from './LoginPage.module.css';

const SIGNED_OUT_MESSAGE_MS = 5000;
type LoginNotice = SignOutNotice | 'restore-failed';

const NOTICE_ID = 'login-notice';

const PAGE_INFO = {
  title: 'Login – Careme',
  heading: 'Sign in to your account',
};

function LoginPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Read once into local state: the navigation state is cleared below, but the
  // message must stay visible until the user closes it (or, for a confirmed
  // logout, until the timer below removes it).
  const restoreFailed = useAuthStore(
    (state) => state.restoreStatus === 'failed',
  );
  const setRestoreStatus = useAuthStore((state) => state.setRestoreStatus);
  const [notice, setNotice] = useState<LoginNotice | null>(
    () =>
      getSignOutNotice(location.state) ??
      (restoreFailed ? 'restore-failed' : null),
  );

  // Closing the notice removes the button that may have the focus: hand it to
  // the heading instead of letting it fall back to <body>. When the timer
  // closes it, the focus is only moved if it was on the notice.
  const closeNotice = (onlyIfFocused = false) => {
    const hadFocus = document
      .getElementById(NOTICE_ID)
      ?.contains(document.activeElement);
    setNotice(null);
    if (!onlyIfFocused || hadFocus) {
      headingRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!notice) {
      return;
    }
    // After a logout the button that had focus is gone: without this the focus
    // falls back to <body> and a keyboard or screen reader user starts over.
    headingRef.current?.focus();
    // The warning is shown once: the next visit to /login starts clean.
    if (restoreFailed) {
      setRestoreStatus('restored');
    }
    // The state lives in the history entry and survives a reload: clear it
    // through the router (not history.replaceState, which would wipe the
    // router's own key and idx) so the message does not come back.
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
    // An unconfirmed logout is a warning the user must be able to read: it
    // stays until closed.
    if (notice === 'signed-out') {
      const timer = setTimeout(() => closeNotice(true), SIGNED_OUT_MESSAGE_MS);
      return () => clearTimeout(timer);
    }
    // Runs once on mount: the location only matters at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The session restore already ran (SessionRestore waits for it), so a user
  // with a valid cookie is in the store even right after a page reload.
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout
      info={PAGE_INFO}
      headingRef={headingRef}
      headingDescribedBy={notice ? NOTICE_ID : undefined}
    >
      <LoginForm />
      {/* After the form in the DOM: it is positioned at the bottom, so the
          tab order matches what is seen (WCAG 2.4.3). */}
      {notice === 'signed-out' && (
        <Feedback
          id={NOTICE_ID}
          status="info"
          title="You have been signed out"
          customClassName={styles.loginFeedback}
          onClose={() => closeNotice()}
        />
      )}
      {notice === 'restore-failed' && (
        <Feedback
          id={NOTICE_ID}
          status="error"
          title="We couldn't restore your session"
          description="Check your connection and sign in again."
          customClassName={styles.loginFeedback}
          onClose={() => closeNotice()}
        />
      )}
      {notice === 'unconfirmed' && (
        <Feedback
          id={NOTICE_ID}
          status="error"
          title="We couldn't confirm the sign out"
          description="Your session may still be active on this device. Close this browser window, or sign in and sign out again."
          customClassName={styles.loginFeedback}
          onClose={() => closeNotice()}
        />
      )}
    </AuthLayout>
  );
}

export default LoginPage;
