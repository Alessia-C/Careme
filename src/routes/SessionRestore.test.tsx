import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../router';
import useAuthStore from '../stores/authStore';

const meResponse = () =>
  Response.json({
    user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
  });

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('SessionRestore', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    useAuthStore.setState({ user: null, role: null, restoreStatus: 'pending' });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('shows a loading status instead of redirecting while it waits', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const router = renderAt('/');

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(router.state.location.pathname).toBe('/');
  });

  it('restores the session and keeps the protected page after a reload', async () => {
    fetchMock.mockResolvedValue(meResponse());
    const router = renderAt('/');

    expect(
      await screen.findByRole('button', { name: 'Logout' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(useAuthStore.getState().user).toEqual({
      id: 'user-1',
      email: 'jane@example.com',
    });
    expect(useAuthStore.getState().role).toBe('user');
  });

  it('asks the API only once, even if the tree re-renders', async () => {
    fetchMock.mockResolvedValue(meResponse());
    renderAt('/');
    await screen.findByRole('button', { name: 'Logout' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me');
  });

  it('redirects to /login without any message when there is no session', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const router = renderAt('/');

    expect(
      await screen.findByText('Sign in to your account'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('redirects a logged-in user away from /login after a reload', async () => {
    fetchMock.mockResolvedValue(meResponse());
    const router = renderAt('/login');

    expect(
      await screen.findByRole('button', { name: 'Logout' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('redirects to /login with an error message when the check fails', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const router = renderAt('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't restore your session",
    );
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows the error message on /login too, only once', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt('/login');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(useAuthStore.getState().restoreStatus).toBe('restored');
  });

  it('does not ask again once the first check is done', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    renderAt('/login');
    await screen.findByText('Sign in to your account');

    expect(useAuthStore.getState().restoreStatus).toBe('restored');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
