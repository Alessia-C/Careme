import { createBrowserRouter, type RouteObject } from 'react-router';
import ProtectedRoute from './routes/ProtectedRoute/ProtectedRoute';
import SessionRestore from './routes/SessionRestore/SessionRestore';
import AppLayout from './routes/AppLayout/AppLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage/LoginPage';
import SignupPage from './pages/SignupPage/SignupPage';

export const routes: RouteObject[] = [
  // Signup needs no session check: it stays outside SessionRestore, which
  // runs the first time the user reaches any other route.
  { path: '/signup', element: <SignupPage /> },
  {
    element: <SessionRestore />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [{ path: '/', element: <HomePage /> }],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
