import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router';
import AuthLayout from '../../components/AuthLayout/AuthLayout';
import Feedback from '../../components/Feedback/Feedback';
import { isAuthenticated } from '../../lib/auth';
import { isSignedOutState } from '../../lib/signedOut';
import LoginForm from './components/LoginForm/LoginForm';

const PAGE_INFO = {
  title: 'Login – Careme',
  heading: 'Sign in to your account',
};

function LoginPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { state } = useLocation();
  const isSignedOut = isSignedOutState(state);

  // After a logout the button that had focus is gone: without this the focus
  // falls back to <body> and a keyboard or screen reader user starts over.
  useEffect(() => {
    if (isSignedOut) {
      headingRef.current?.focus();
    }
  }, [isSignedOut]);

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
          description="Sign in again to continue."
        />
      )}
      <LoginForm />
    </AuthLayout>
  );
}

export default LoginPage;
