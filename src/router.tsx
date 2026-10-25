import { createBrowserRouter, type RouteObject } from 'react-router';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './routes/AppLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage/LoginPage';
import SignupPage from './pages/SignupPage/SignupPage';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: '/', element: <HomePage /> }],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
