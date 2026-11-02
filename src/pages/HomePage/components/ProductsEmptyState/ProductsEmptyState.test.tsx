import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProductsEmptyState from './ProductsEmptyState';

const renderState = (
  view: Parameters<typeof ProductsEmptyState>[0]['view'],
) => {
  const onRetry = vi.fn();
  const onAdd = vi.fn();
  render(<ProductsEmptyState view={view} onRetry={onRetry} onAdd={onAdd} />);
  return { onRetry, onAdd };
};

describe('ProductsEmptyState', () => {
  it('announces the loading state', () => {
    renderState('loading');

    expect(screen.getByRole('status')).toHaveTextContent('Loading products');
  });

  it('offers to try again on error', async () => {
    const { onRetry } = renderState('error');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('invites to add the first product', async () => {
    const { onAdd } = renderState('first-access');

    expect(
      screen.getByRole('heading', { name: 'Add your product' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('says that nothing was found, without actions', () => {
    renderState('no-results');

    expect(
      screen.getByRole('heading', { name: 'No product found' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
