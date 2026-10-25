import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthenticated } from './lib/auth';
import { routes } from './router';

vi.mock('./lib/auth', () => ({ isAuthenticated: vi.fn() }));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('routes', () => {
  beforeEach(() => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
  });

  it('redirects to /login keeping the destination when unauthenticated', () => {
    const router = renderAt('/');

    expect(screen.getByText('Accedi')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2F');
  });

  it('renders the protected page when authenticated', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    renderAt('/');

    expect(screen.getByText('Careme')).toBeInTheDocument();
  });

  it('shows the app header on protected pages', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    renderAt('/');

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it.each([
    ['/login', 'Accedi'],
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
