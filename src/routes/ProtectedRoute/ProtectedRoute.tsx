import { Navigate, Outlet, useLocation } from 'react-router';
import { isAuthenticated } from '../../lib/auth';

function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated()) {
    // Keep the requested path so the login can send the user back after
    // signing in.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
