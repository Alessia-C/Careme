import { render, screen, waitFor } from '@testing-library/react';
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

function CurrentPath() {
  const { pathname, search } = useLocation();
  return <p>{`at ${pathname}${search}`}</p>;
}

const renderPage = (initialEntry: string | object = '/login') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
