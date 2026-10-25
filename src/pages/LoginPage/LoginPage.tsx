import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import AuthLayout from '../../components/AuthLayout/AuthLayout';
import Feedback from '../../components/Feedback/Feedback';
import { isAuthenticated } from '../../lib/auth';
import { isSignedOutState } from '../../lib/signedOut';
import LoginForm from './components/LoginForm/LoginForm';
import styles from './LoginPage.module.css';

const SIGNED_OUT_MESSAGE_MS = 5000;

const PAGE_INFO = {
  title: 'Login – Careme',
  heading: 'Sign in to your account',
};

function LoginPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Read once into local state: the navigation state is cleared below, but the
  // message must stay visible until the timer below removes it.
  const [isSignedOut, setIsSignedOut] = useState(() =>
    isSignedOutState(location.state),
  );

  useEffect(() => {
    if (!isSignedOut) {
      return;
    }
    // After a logout the button that had focus is gone: without this the focus
    // falls back to <body> and a keyboard or screen reader user starts over.
    headingRef.current?.focus();
    // The state lives in the history entry and survives a reload: clear it
    // through the router (not history.replaceState, which would wipe the
    // router's own key and idx) so the message does not come back.
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
    const timer = setTimeout(
      () => setIsSignedOut(false),
      SIGNED_OUT_MESSAGE_MS,
    );
    return () => clearTimeout(timer);
    // Runs once on mount: the location only matters at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the in-memory session is known here: after a page reload the user
  // sees the form again until the session restore exists.
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout info={PAGE_INFO} headingRef={headingRef}>
      {isSignedOut && (
        <Feedback
          status="info"
          title="You have been signed out"
          customClassName={styles.loginFeedback}
        />
      )}
      <LoginForm />
    </AuthLayout>
  );
}

export default LoginPage;
