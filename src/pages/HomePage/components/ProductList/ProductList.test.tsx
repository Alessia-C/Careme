import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProductListItem } from '../../../../lib/productsApi';
import ProductList from './ProductList';

const products: ProductListItem[] = [
  {
    id: 'p1',
    name: 'Eye Palette',
    brand: 'MAC',
    category: 'makeup',
    status: 'new',
  },
  {
    id: 'p2',
    name: 'Serum',
    brand: 'Cerave',
    category: 'skincare',
    status: 'used',
  },
];

describe('ProductList', () => {
  it('renders a list with one item per product', () => {
    render(
      <ProductList products={products} onDetail={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByRole('list', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('passes the chosen product to onDetail', async () => {
    const onDetail = vi.fn();
    render(
      <ProductList
        products={products}
        onDetail={onDetail}
        onDelete={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Detail Serum' }));

    expect(onDetail).toHaveBeenCalledExactlyOnceWith(products[1]);
  });

  it('passes the chosen product to onDelete', async () => {
    const onDelete = vi.fn();
    render(
      <ProductList
        products={products}
        onDetail={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete Serum' }));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(products[1]);
  });
});
