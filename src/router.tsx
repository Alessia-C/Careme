import { createBrowserRouter, type RouteObject } from 'react-router';
import ProtectedRoute from './routes/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

export const routes: RouteObject[] = [
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  // Protected routes: add new feature pages to `children`.
  {
    element: <ProtectedRoute />,
    children: [{ path: '/', element: <HomePage /> }],
  },
];

export const router = createBrowserRouter(routes);
