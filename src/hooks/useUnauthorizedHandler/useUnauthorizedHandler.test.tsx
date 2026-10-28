import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../../lib/apiFetch';
import { handleUnauthorized } from '../../lib/unauthorized';
import useAuthStore from '../../stores/authStore';
import { useUnauthorizedHandler } from './useUnauthorizedHandler';

const { logout, broadcastLogout } = vi.hoisted(() => ({
  logout: vi.fn(),
  broadcastLogout: vi.fn(),
}));

vi.mock('../../lib/authApi', () => ({ logout }));
vi.mock('../../lib/logoutChannel', () => ({ broadcastLogout }));

function Tab() {
  useUnauthorizedHandler();
  return <p>Protected page</p>;
}

function renderTab(queryClient = new QueryClient()) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Tab /> },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/'] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, queryClient, router };
}

beforeEach(() => {
  logout.mockReset();
  broadcastLogout.mockReset();
  logout.mockResolvedValue({ ok: true });
  useAuthStore
    .getState()
    .setSession({ id: 'user-1', email: 'jane@example.com' }, 'user');
});

afterEach(() => {
  useAuthStore.setState({ user: null, role: null });
});

describe('useUnauthorizedHandler', () => {
  it('takes the user to the login with the expired notice on a 401', async () => {
    const { router, queryClient } = renderTab();
    queryClient.setQueryData(['products'], [{ id: 1 }]);

    act(() => handleUnauthorized(new UnauthorizedError()));

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
    expect(queryClient.getQueryData(['products'])).toBeUndefined();
    expect(router.state.location.state).toEqual({
      signedOut: true,
      expired: true,
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).toHaveBeenCalledWith('expired');
  });

  it('warns that the cookie may remain when the logout is not confirmed', async () => {
    logout.mockResolvedValue({ ok: false, reason: 'failed' });
    const { router } = renderTab();

    act(() => handleUnauthorized(new UnauthorizedError()));

    await screen.findByText('Login page');
    expect(router.state.location.state).toEqual({
      signedOut: true,
      confirmed: false,
    });
    expect(broadcastLogout).toHaveBeenCalledWith('unconfirmed');
  });

  it('ends the session only once when several requests fail together', async () => {
    renderTab();

    act(() => {
      handleUnauthorized(new UnauthorizedError());
      handleUnauthorized(new UnauthorizedError());
      handleUnauthorized(new UnauthorizedError());
    });

    await screen.findByText('Login page');
    expect(logout).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).toHaveBeenCalledTimes(1);
  });

  it('ignores errors that are not a 401', () => {
    renderTab();

    act(() => handleUnauthorized(new Error('boom')));

    expect(screen.getByText('Protected page')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });
});
