import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProductListSection from './ProductListSection';

const products = [
  {
    id: 'p1',
    name: 'Cleanser',
    brand: 'CeraVe',
    category: 'skincare',
    status: 'new',
  },
] as const;

const renderSection = (
  props: Partial<Parameters<typeof ProductListSection>[0]> = {},
) => {
  const onLoadMore = vi.fn();
  render(
    <ProductListSection
      products={[...products]}
      isBusy={false}
      hasNextPage={false}
      isFetchingNextPage={false}
      isFetchNextPageError={false}
      onDetail={vi.fn()}
      onLoadMore={onLoadMore}
      {...props}
    />,
  );
  return { onLoadMore };
};

describe('ProductListSection', () => {
  it('has no "Load more" button on the last page', () => {
    renderSection();

    expect(screen.getByRole('list', { name: 'Products' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
  });

  it('loads more products on click', async () => {
    const { onLoadMore } = renderSection({ hasNextPage: true });

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks while loading', async () => {
    const { onLoadMore } = renderSection({
      hasNextPage: true,
      isFetchingNextPage: true,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Loading…' }));

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('shows the error of a failed load', () => {
    renderSection({ isFetchNextPageError: true });

    expect(
      screen.getByText('We couldn’t load more products'),
    ).toBeInTheDocument();
  });
});
