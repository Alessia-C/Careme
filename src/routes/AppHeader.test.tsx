import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { logout } from '../lib/authApi';
import useAuthStore from '../stores/authStore';
import AppHeader from './AppHeader';

vi.mock('../lib/authApi', () => ({ logout: vi.fn() }));

const postMessage = vi.fn();
const close = vi.fn();

class FakeBroadcastChannel {
  constructor(public name: string) {}
  postMessage = postMessage;
  close = close;
}

function renderHeader(queryClient = new QueryClient()) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <AppHeader /> },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  vi.mocked(logout).mockResolvedValue({ ok: true });
  useAuthStore
    .getState()
    .setSession({ id: 'user-1', email: 'jane@example.com' }, 'user');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, role: null });
});

describe('AppHeader', () => {
  it('exposes the logo as an image named "Careme"', () => {
    renderHeader();
    expect(screen.getByRole('img', { name: 'Careme' })).toBeInTheDocument();
  });

  it('renders the Logout action with its label as accessible name', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it('renders inside the banner landmark', () => {
    renderHeader();
    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Logout' }),
    );
  });
});

describe('AppHeader - logout', () => {
  it('calls the API, empties the store and goes to the login', async () => {
    const { router } = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().role).toBeNull();
  });

  it('clears the React Query cache', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['products'], [{ id: 1 }]);
    renderHeader(queryClient);

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await screen.findByText('Login page');
    expect(queryClient.getQueryData(['products'])).toBeUndefined();
  });

  it('tells the other tabs', async () => {
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await screen.findByText('Login page');
    expect(postMessage).toHaveBeenCalledWith('logout');
    expect(close).toHaveBeenCalled();
  });

  it('disables the button while the request is in flight', async () => {
    let finish: () => void = () => {};
    vi.mocked(logout).mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ ok: true });
      }),
    );
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(screen.getByRole('button', { name: 'Logout' })).toBeDisabled();
    expect(useAuthStore.getState().user).not.toBeNull();

    finish();
    await screen.findByText('Login page');
  });

  it.each([
    ['the request fails', { ok: false, reason: 'failed' } as const],
    ['the session was already over', { ok: true } as const],
  ])('empties the store and redirects when %s', async (_label, result) => {
    vi.mocked(logout).mockResolvedValue(result);
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
