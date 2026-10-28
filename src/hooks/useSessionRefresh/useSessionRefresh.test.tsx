import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from '../../stores/authStore';
import { useSessionRefresh } from './useSessionRefresh';

const {
  refreshSession,
  logout,
  broadcastRefresh,
  listenForRefresh,
  broadcastLogout,
} = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  logout: vi.fn(),
  broadcastRefresh: vi.fn(),
  listenForRefresh: vi.fn(),
  broadcastLogout: vi.fn(),
}));

vi.mock('../../lib/authApi', () => ({ refreshSession, logout }));
vi.mock('../../lib/logoutChannel', () => ({ broadcastLogout }));
vi.mock('../../lib/sessionChannel', () => ({
  broadcastRefresh,
  listenForRefresh,
}));

const NOW = new Date('2026-10-26T10:00:00Z');
const nowSeconds = NOW.getTime() / 1000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
// The hook renews one minute before the expiry.
const RENEWAL_MS = HOUR_MS - MINUTE_MS;

function Tab() {
  useSessionRefresh();
  return <p>Protected page</p>;
}

function renderTab() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Tab /> },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/'] },
  );
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const userIsActive = () =>
  act(() => {
    window.dispatchEvent(new Event('pointerdown'));
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  listenForRefresh.mockReturnValue(() => {});
  logout.mockResolvedValue({ ok: true });
  refreshSession.mockResolvedValue({
    ok: true,
    expiresAt: nowSeconds + 2 * 3600,
  });
  useAuthStore
    .getState()
    .setSession(
      { id: 'user-1', email: 'jane@example.com' },
      'user',
      nowSeconds + 3600,
    );
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, role: null, expiresAt: null });
});

describe('useSessionRefresh - active user', () => {
  it('renews the session a minute before it expires', async () => {
    renderTab();
    userIsActive();

    await advance(RENEWAL_MS - 1000);
    expect(refreshSession).not.toHaveBeenCalled();

    await advance(1000);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('stores the new expiry and tells the other tabs', async () => {
    renderTab();
    userIsActive();

    await advance(RENEWAL_MS);

    expect(useAuthStore.getState().expiresAt).toBe(nowSeconds + 2 * 3600);
    expect(broadcastRefresh).toHaveBeenCalledWith(nowSeconds + 2 * 3600);
  });

  it('schedules the next renewal from the new expiry', async () => {
    renderTab();
    userIsActive();
    await advance(RENEWAL_MS);
    expect(refreshSession).toHaveBeenCalledTimes(1);

    // Activity restarts for the new session: without it nothing is renewed.
    userIsActive();
    await advance(HOUR_MS);

    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it('does not start a second renewal while one is in flight', async () => {
    refreshSession.mockReturnValue(new Promise(() => {}));
    renderTab();
    userIsActive();

    await advance(RENEWAL_MS);
    userIsActive();
    await advance(MINUTE_MS);

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not fire early when the expiry is too far for one timeout', async () => {
    useAuthStore.getState().setExpiresAt(nowSeconds + 60 * 24 * 3600);
    renderTab();
    userIsActive();

    await advance(30 * 24 * 3600 * 1000);

    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe('useSessionRefresh - idle user', () => {
  it('does not renew and ends the session when it expires', async () => {
    renderTab();

    await advance(RENEWAL_MS);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(screen.getByText('Protected page')).toBeInTheDocument();

    await advance(MINUTE_MS);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logs out on the server, so the cookies are cleared and the session revoked', async () => {
    renderTab();

    await advance(HOUR_MS);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).toHaveBeenCalledWith('expired');
  });

  it('tells the login page when the server could not confirm the logout', async () => {
    logout.mockResolvedValue({ ok: false, reason: 'failed' });
    renderTab();

    await advance(HOUR_MS);

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(broadcastLogout).toHaveBeenCalledWith('unconfirmed');
  });

  it('does not log out before the session expires', async () => {
    renderTab();

    await advance(HOUR_MS - 1000);

    expect(logout).not.toHaveBeenCalled();
  });

  it('renews when the user comes back before the session expires', async () => {
    renderTab();
    await advance(RENEWAL_MS);

    userIsActive();
    await advance(0);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    await advance(MINUTE_MS);
    expect(screen.getByText('Protected page')).toBeInTheDocument();
  });

  it('ignores activity from before the last renewal', async () => {
    renderTab();
    userIsActive();
    await advance(RENEWAL_MS);
    expect(refreshSession).toHaveBeenCalledTimes(1);

    // The new renewal is due at +119 minutes, the new expiry at +120.
    await advance(HOUR_MS + MINUTE_MS);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});

describe('useSessionRefresh - failures', () => {
  it('takes the user to the login when the session is gone', async () => {
    refreshSession.mockResolvedValue({ ok: false, reason: 'no-session' });
    const { router } = renderTab();
    userIsActive();

    await advance(RENEWAL_MS);

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
    expect(router.state.location.state).toEqual({
      signedOut: true,
      expired: true,
    });
  });

  it('keeps the session and tries again after a network error', async () => {
    refreshSession.mockResolvedValueOnce({ ok: false, reason: 'failed' });
    renderTab();
    userIsActive();

    await advance(RENEWAL_MS);
    expect(screen.getByText('Protected page')).toBeInTheDocument();
    expect(refreshSession).toHaveBeenCalledTimes(1);

    await advance(15_000);
    expect(refreshSession).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().expiresAt).toBe(nowSeconds + 2 * 3600);
  });
});

describe('useSessionRefresh - lifecycle', () => {
  it('does nothing without a session', async () => {
    useAuthStore.setState({ user: null, role: null, expiresAt: null });
    renderTab();
    userIsActive();

    await advance(2 * HOUR_MS);

    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('follows the expiry set by another tab', async () => {
    let onOtherTabRefresh: (expiresAt: number) => void = () => {};
    listenForRefresh.mockImplementation((callback) => {
      onOtherTabRefresh = callback;
      return () => {};
    });
    renderTab();
    userIsActive();

    act(() => onOtherTabRefresh(nowSeconds + 2 * 3600));
    userIsActive();
    await advance(RENEWAL_MS);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(screen.getByText('Protected page')).toBeInTheDocument();

    await advance(HOUR_MS);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('stops its timer and listeners on unmount', async () => {
    const stopListening = vi.fn();
    listenForRefresh.mockReturnValue(stopListening);
    const { unmount } = renderTab();
    userIsActive();

    unmount();
    await advance(2 * HOUR_MS);
    userIsActive();

    expect(refreshSession).not.toHaveBeenCalled();
    expect(stopListening).toHaveBeenCalled();
  });
});
