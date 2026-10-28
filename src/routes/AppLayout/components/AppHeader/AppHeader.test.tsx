import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { logout } from '../../../../lib/authApi';
import useAuthStore from '../../../../stores/authStore';
import AppHeader from './AppHeader';

vi.mock('../../../../lib/authApi', () => ({ logout: vi.fn() }));

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

  it('has an empty status region until a logout is in progress', () => {
    renderHeader();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
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
    expect(router.state.location.state).toEqual({
      signedOut: true,
      confirmed: true,
    });
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

  it('keeps the button focusable but inert while the request is in flight', async () => {
    let finish: () => void = () => {};
    vi.mocked(logout).mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ ok: true });
      }),
    );
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    const button = screen.getByRole('button', { name: 'Logout' });
    // aria-disabled, not disabled: the button keeps its keyboard focus.
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Logging out…');
    expect(useAuthStore.getState().user).not.toBeNull();

    await userEvent.click(button);
    expect(logout).toHaveBeenCalledTimes(1);

    finish();
    await screen.findByText('Login page');
  });

  it('is not aria-disabled when idle', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Logout' })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  it('empties the store and redirects when the session was already over', async () => {
    vi.mocked(logout).mockResolvedValue({ ok: true });
    const { router } = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.state).toEqual({
      signedOut: true,
      confirmed: true,
    });
  });

  it('still empties the store but flags the logout as unconfirmed when the request fails', async () => {
    vi.mocked(logout).mockResolvedValue({ ok: false, reason: 'failed' });
    const { router } = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.state).toEqual({
      signedOut: true,
      confirmed: false,
    });
    expect(postMessage).toHaveBeenCalledWith('logout-unconfirmed');
  });
});
