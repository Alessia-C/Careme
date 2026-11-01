import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import HomePage from './HomePage';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HomePage />
    </QueryClientProvider>,
  );

const getDrawer = () => screen.getByRole('dialog', { hidden: true });

describe('HomePage', () => {
  it('invites the user to add the first product', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your products' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Add your product' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Start by adding your first product to manage your catalog',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the drawer closed at first', () => {
    renderPage();
    expect(getDrawer()).not.toHaveAttribute('open');
  });

  it('opens the drawer from the Add product button', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));

    expect(getDrawer()).toHaveAttribute('open');
    expect(
      screen.getByRole('dialog', { name: 'Add Product' }),
    ).toBeInTheDocument();
  });

  it('closes the drawer from Cancel', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(getDrawer()).not.toHaveAttribute('open');
  });

  it('starts from an empty form every time the drawer opens', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add product' }));
    await user.type(screen.getByLabelText('Name*'), 'Eye Palette');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(screen.getByLabelText('Name*')).toHaveValue('');
  });
});
