import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { UnauthorizedError } from '../../lib/apiFetch';
import { handleUnauthorized } from '../../lib/unauthorized';
import AppLayout from './AppLayout';

function renderLayout() {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [{ path: '/', element: <p>Page content</p> }],
      },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppLayout', () => {
  it('renders the header and the page content inside main', () => {
    renderLayout();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(
      screen.getByText('Page content'),
    );
  });

  it('links the skip link to the main landmark', () => {
    renderLayout();

    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('puts the skip link first in the tab order', async () => {
    renderLayout();

    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
  });

  it('reaches the Logout action right after the skip link', async () => {
    renderLayout();

    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Logout' })).toHaveFocus();
  });

  it('sends the user to the login when a protected request answers 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    renderLayout();

    act(() => handleUnauthorized(new UnauthorizedError()));

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
