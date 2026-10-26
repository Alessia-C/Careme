import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from '../../stores/authStore';
import LoginPage from './LoginPage';

const loginResponse = () =>
  Response.json({
    message: 'Login successful',
    user: { id: 'user-1', email: 'jane@example.com', role: 'admin' },
  });

function StateProbe() {
  const { state } = useLocation();
  return <p>{`router state: ${JSON.stringify(state)}`}</p>;
}

function CurrentPath() {
  const { pathname, search } = useLocation();
  return <p>{`at ${pathname}${search}`}</p>;
}

const renderPage = (initialEntry: string | object = '/login') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/login"
            element={
              <>
                <StateProbe />
                <LoginPage />
              </>
            }
          />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const submitButton = () => screen.getByRole('button', { name: /sign in/i });

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email*'), 'jane@example.com');
  await user.type(screen.getByLabelText('Password*'), 'any-password');
}

describe('LoginPage - after a logout', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('tells the user they were signed out and focuses the heading', () => {
    renderPage({ pathname: '/login', state: { signedOut: true } });

    expect(screen.getByRole('status')).toHaveTextContent(
      'You have been signed out',
    );
    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).toHaveFocus();
  });

  it('clears the navigation state but keeps the message visible', async () => {
    renderPage({ pathname: '/login', state: { signedOut: true } });

    expect(await screen.findByText('router state: null')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'You have been signed out',
    );
  });

  it('removes the message after 5 seconds', () => {
    vi.useFakeTimers();
    try {
      renderPage({ pathname: '/login', state: { signedOut: true } });

      act(() => vi.advanceTimersByTime(4999));
      expect(screen.getByRole('status')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes the message with its close button', async () => {
    renderPage({ pathname: '/login', state: { signedOut: true } });

    await userEvent.click(
      screen.getByRole('button', { name: 'Close message' }),
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('moves the focus to the heading when the message is closed', async () => {
    renderPage({ pathname: '/login', state: { signedOut: true } });

    screen.getByRole('button', { name: 'Close message' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).toHaveFocus();
  });

  it('moves the focus to the heading when the timer closes a focused message', () => {
    vi.useFakeTimers();
    try {
      renderPage({ pathname: '/login', state: { signedOut: true } });
      screen.getByRole('button', { name: 'Close message' }).focus();

      act(() => vi.advanceTimersByTime(5000));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Sign in to your account' }),
      ).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves the focus alone when the timer closes a message that is not focused', () => {
    vi.useFakeTimers();
    try {
      renderPage({ pathname: '/login', state: { signedOut: true } });
      screen.getByLabelText('Email*').focus();

      act(() => vi.advanceTimersByTime(5000));

      expect(screen.getByLabelText('Email*')).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('puts the message after the form, in the order it is shown', () => {
    renderPage({ pathname: '/login', state: { signedOut: true } });

    const form = screen.getByLabelText('Email*');
    const message = screen.getByRole('status');
    expect(
      form.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('reads the message together with the heading it focuses', () => {
    renderPage({ pathname: '/login', state: { signedOut: true } });

    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).toHaveAccessibleDescription('You have been signed out');
  });

  it('does not describe the heading when there is no message', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).not.toHaveAttribute('aria-describedby');
  });

  it('warns with an alert when the logout was not confirmed', () => {
    renderPage({
      pathname: '/login',
      state: { signedOut: true, confirmed: false },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't confirm the sign out",
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'may still be active on this device',
    );
    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).toHaveFocus();
  });

  it('keeps the unconfirmed warning until it is closed, with no timer', async () => {
    vi.useFakeTimers();
    try {
      renderPage({
        pathname: '/login',
        state: { signedOut: true, confirmed: false },
      });

      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByRole('alert')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }

    await userEvent.click(
      screen.getByRole('button', { name: 'Close message' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the navigation state also for the unconfirmed warning', async () => {
    renderPage({
      pathname: '/login',
      state: { signedOut: true, confirmed: false },
    });

    expect(await screen.findByText('router state: null')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows no message and keeps the focus where it is on a normal visit', () => {
    renderPage();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).not.toHaveFocus();
  });
});

describe('LoginPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAuthStore.getState().clearSession();
    fetchMock = vi.fn(() => Promise.resolve(loginResponse()));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the form with a link to the signup page', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to the registration' }),
    ).toHaveAttribute('href', '/signup');
  });

  it('shows the forgot password button disabled', () => {
    renderPage();

    expect(
      screen.getByRole('button', { name: 'Forgot password?' }),
    ).toBeDisabled();
  });

  it('keeps the submit button disabled while the form is empty', () => {
    renderPage();
    expect(submitButton()).toBeDisabled();
  });

  it('enables the button with a valid email and any non-empty password', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    expect(submitButton()).toBeEnabled();
  });

  it('does not apply the signup password policy', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Email*'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password*'), 'a');
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByText('1 uppercase letter')).not.toBeInTheDocument();
  });

  it('shows an inline error for a malformed email after blur', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Email*'), 'not-an-email');
    await user.tab();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('marks an empty password as invalid after blur', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByLabelText('Password*'));
    await user.tab();
    expect(screen.getByLabelText('Password*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('sends the credentials, stores the session and goes to the homepage', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByText('at /')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(init.body)).toEqual({
      email: 'jane@example.com',
      password: 'any-password',
    });
    const { user: sessionUser, role } = useAuthStore.getState();
    expect(sessionUser).toEqual({ id: 'user-1', email: 'jane@example.com' });
    expect(role).toBe('admin');
  });

  it('goes back to the page requested before the login', async () => {
    const user = userEvent.setup();
    renderPage('/login?next=%2Fproducts%3Fpage%3D2');
    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByText('at /products?page=2')).toBeInTheDocument();
  });

  it('ignores an external next and goes to the homepage', async () => {
    const user = userEvent.setup();
    renderPage('/login?next=https%3A%2F%2Fevil.example');
    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByText('at /')).toBeInTheDocument();
  });

  it('redirects an already authenticated user to the homepage', () => {
    useAuthStore
      .getState()
      .setSession({ id: 'user-1', email: 'jane@example.com' }, 'user');
    renderPage();

    expect(screen.getByText('at /')).toBeInTheDocument();
  });

  it('disables the button and shows progress while submitting', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(submitButton());

    expect(
      await screen.findByRole('button', { name: 'Signing in…' }),
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([400, 403])(
    'shows the same generic credentials error on %i',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await user.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Invalid email or password',
      );
      expect(useAuthStore.getState().user).toBeNull();
      expect(submitButton()).toBeEnabled();
    },
  );

  it('shows a specific message on rate limit', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts',
    );
  });

  it('shows a retry message on a network failure and allows a retry', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('try again');

    await user.click(submitButton());
    await waitFor(() => expect(screen.getByText('at /')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
