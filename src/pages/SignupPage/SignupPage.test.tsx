import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignupPage from './SignupPage';

const VALID_PASSWORD = 'Str0ng!pass';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const submitButton = () =>
  screen.getByRole('button', { name: /create account/i });

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First Name*'), 'Jane');
  await user.type(screen.getByLabelText('Last Name*'), 'Doe');
  await user.type(screen.getByLabelText('Email*'), 'jane@example.com');
  await user.type(screen.getByLabelText('Password*'), VALID_PASSWORD);
  await user.type(screen.getByLabelText('Confirm Password*'), VALID_PASSWORD);
}

describe('SignupPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the form with a link to the login page', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('keeps the submit button disabled while the form is empty', () => {
    renderPage();
    expect(submitButton()).toBeDisabled();
  });

  it('enables the submit button when every field is valid', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    expect(submitButton()).toBeEnabled();
  });

  it('shows an inline error for an empty first name after blur', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByLabelText('First Name*'));
    await user.tab();
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows an inline error for a malformed email after blur', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Email*'), 'not-an-email');
    await user.tab();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('shows the password requirements only after the field is focused', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByText('1 uppercase letter')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Password*'));
    expect(screen.getByText('1 uppercase letter')).toBeInTheDocument();
  });

  it('shows only the error state, without the checklist, after blur on an invalid password', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Password*'), 'weakpass');
    await user.tab();
    expect(screen.getByLabelText('Password*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByText('1 uppercase letter')).not.toBeInTheDocument();
  });

  it('shows only the error state, without the helper, after blur on a mismatched confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Password*'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm Password*'), 'different');
    await user.tab();
    expect(screen.getByLabelText('Confirm Password*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByText('Passwords match')).not.toBeInTheDocument();
  });

  it('blocks the button when the password misses a requirement', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Password*'));
    await user.type(screen.getByLabelText('Password*'), 'weakpass');
    expect(submitButton()).toBeDisabled();
  });

  it('blocks the button when the confirmation differs', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.type(screen.getByLabelText('Confirm Password*'), 'x');
    await user.tab();
    expect(screen.getByLabelText('Confirm Password*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(submitButton()).toBeDisabled();
  });

  it('sends the form values to the API and shows the check-email message', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(submitButton());

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Account created successfully!' }),
      ).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/signup');
    expect(JSON.parse(init.body)).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: VALID_PASSWORD,
    });
    expect(screen.getByRole('heading')).toHaveFocus();
    await waitFor(() =>
      expect(document.title).toBe('Account created – Careme'),
    );
  });

  it('disables the button and shows progress while submitting', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(submitButton());

    expect(
      await screen.findByRole('button', { name: 'Creating account…' }),
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a generic error alert when the API fails', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).toHaveTextContent('Please try again');
    expect(submitButton()).toBeEnabled();
  });

  it('shows a specific message on rate limit', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts',
    );
  });

  it('shows the generic error on a network failure and allows a retry', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(submitButton());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Account created successfully!' }),
      ).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
