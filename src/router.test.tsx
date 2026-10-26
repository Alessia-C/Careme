import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthenticated } from './lib/auth';
import useAuthStore from './stores/authStore';
import { routes } from './router';

vi.mock('./lib/auth', () => ({ isAuthenticated: vi.fn() }));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('routes', () => {
  beforeEach(() => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    // The session restore has its own tests (SessionRestore.test.tsx).
    useAuthStore.setState({ restoreStatus: 'restored' });
  });

  it('redirects to /login keeping the destination when unauthenticated', () => {
    const router = renderAt('/');

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2F');
  });

  it('renders the protected page when authenticated', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    renderAt('/');

    expect(screen.getByText('Careme')).toBeInTheDocument();
  });

  it('redirects an authenticated user from /login to the homepage', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    const router = renderAt('/login');

    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Sign in to your account')).toBeNull();
  });

  it('shows the app header on protected pages', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    renderAt('/');

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it.each([
    ['/login', 'Sign in to your account'],
    ['/signup', 'Create your account'],
  ])('serves %s without authentication', (path, heading) => {
    renderAt(path);

    expect(screen.getByText(heading)).toBeInTheDocument();
  });

  it.each([
    ['/login', 'Login – Careme'],
    ['/signup', 'Sign up – Careme'],
  ])('sets the document title on %s', (path, title) => {
    renderAt(path);

    expect(document.title).toBe(title);
  });
});
