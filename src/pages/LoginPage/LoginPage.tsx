import { Navigate } from 'react-router';
import AuthLayout from '../../components/AuthLayout/AuthLayout';
import { isAuthenticated } from '../../lib/auth';
import LoginForm from './components/LoginForm/LoginForm';

const PAGE_INFO = {
  title: 'Login – Careme',
  heading: 'Sign in to your account',
};

function LoginPage() {
  // Only the in-memory session is known here: after a page reload the user
  // sees the form again until the session restore exists.
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout info={PAGE_INFO}>
      <LoginForm />
    </AuthLayout>
  );
}

export default LoginPage;
