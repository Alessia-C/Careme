import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from '../stores/authStore';
import { broadcastLogout } from '../lib/logoutChannel';
import { useLogoutSync } from './useLogoutSync';

// Minimal in-memory BroadcastChannel: like the real one it delivers a message
// to the other instances with the same name, never to the sender.
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;

  constructor(public name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    FakeBroadcastChannel.instances
      .filter((other) => other !== this && other.name === this.name)
      .filter((other) => !other.closed)
      .forEach((other) => other.onmessage?.({ data }));
  }

  close() {
    this.closed = true;
  }
}

function Tab() {
  useLogoutSync();
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
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  useAuthStore
    .getState()
    .setSession({ id: 'user-1', email: 'jane@example.com' }, 'user');
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, role: null });
});

describe('useLogoutSync', () => {
  it('ends the session when another tab broadcasts a logout', async () => {
    const { queryClient } = renderTab();
    queryClient.setQueryData(['products'], [{ id: 1 }]);

    act(() => broadcastLogout());

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
    expect(queryClient.getQueryData(['products'])).toBeUndefined();
  });

  it('tells the login page the logout was confirmed', async () => {
    const { router } = renderTab();

    act(() => broadcastLogout());

    await screen.findByText('Login page');
    expect(router.state.location.state).toEqual({
      signedOut: true,
      confirmed: true,
    });
  });

  it('tells the login page when the other tab could not confirm it', async () => {
    const { router } = renderTab();

    act(() => broadcastLogout('unconfirmed'));

    await screen.findByText('Login page');
    expect(useAuthStore.getState().user).toBeNull();
    expect(router.state.location.state).toEqual({
      signedOut: true,
      confirmed: false,
    });
  });

  it('tells the login page the session expired in the other tab', async () => {
    const { router } = renderTab();

    act(() => broadcastLogout('expired'));

    await screen.findByText('Login page');
    expect(router.state.location.state).toEqual({
      signedOut: true,
      expired: true,
    });
  });

  it('ignores messages other than logout', () => {
    renderTab();
    const [listener] = FakeBroadcastChannel.instances;

    act(() => listener.onmessage?.({ data: 'something-else' }));

    expect(screen.getByText('Protected page')).toBeInTheDocument();
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('closes its channel on unmount', () => {
    const { unmount } = renderTab();
    const [listener] = FakeBroadcastChannel.instances;

    unmount();

    expect(listener.closed).toBe(true);
  });

  it('does nothing where BroadcastChannel is not available', () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    expect(() => renderTab()).not.toThrow();
    expect(() => broadcastLogout()).not.toThrow();
  });
});
