import { createBrowserRouter, type RouteObject } from 'react-router';
import ProtectedRoute from './routes/ProtectedRoute/ProtectedRoute';
import RootLayout from './routes/RootLayout/RootLayout';
import SessionRestore from './routes/SessionRestore/SessionRestore';
import AppLayout from './routes/AppLayout/AppLayout';
import HomePage from './pages/HomePage/HomePage';
import LoginPage from './pages/LoginPage/LoginPage';
import SignupPage from './pages/SignupPage/SignupPage';

export const routes: RouteObject[] = [
  {
    // RootLayout wraps every route, including signup, so scroll handling
    // applies to all pages.
    element: <RootLayout />,
    children: [
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
    ],
  },
];

export const router = createBrowserRouter(routes);
