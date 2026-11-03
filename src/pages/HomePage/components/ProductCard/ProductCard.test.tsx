import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProductListItem } from '../../../../lib/productsApi';
import ProductCard from './ProductCard';

const product: ProductListItem = {
  id: 'p1',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
};

describe('ProductCard', () => {
  it('shows name, category, status and brand', () => {
    render(
      <ProductCard product={product} onDetail={vi.fn()} onDelete={vi.fn()} />,
    );

    const card = screen.getByRole('article', { name: 'Eye Palette' });
    expect(
      within(card).getByRole('heading', { level: 2, name: 'Eye Palette' }),
    ).toBeInTheDocument();
    expect(within(card).getByText('Makeup')).toBeInTheDocument();
    expect(within(card).getByText('New')).toBeInTheDocument();
    expect(within(card).getByText('Brand')).toBeInTheDocument();
    expect(within(card).getByText('MAC')).toBeInTheDocument();
  });

  it.each([
    ['skincare', 'Skincare'],
    ['makeup', 'Makeup'],
  ] as const)('labels the %s category', (category, label) => {
    render(
      <ProductCard
        product={{ ...product, category }}
        onDetail={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    ['new', 'New'],
    ['used', 'Used'],
    ['finished', 'Finished'],
  ] as const)('labels the %s status', (status, label) => {
    render(
      <ProductCard
        product={{ ...product, status }}
        onDetail={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(label)).toHaveAttribute('data-status', status);
  });

  it('renders the text as text, never as HTML', () => {
    render(
      <ProductCard
        product={{ ...product, name: '<img src=x onerror=alert(1)>' }}
        onDetail={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' }),
    ).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('calls onDetail with the product from the Detail button', async () => {
    const onDetail = vi.fn();
    render(
      <ProductCard product={product} onDetail={onDetail} onDelete={vi.fn()} />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Detail Eye Palette' }),
    );

    expect(onDetail).toHaveBeenCalledExactlyOnceWith(product);
  });

  it('calls onDelete with the product from the Delete button', async () => {
    const onDelete = vi.fn();
    render(
      <ProductCard product={product} onDetail={vi.fn()} onDelete={onDelete} />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete Eye Palette' }),
    );

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(product);
  });
});
