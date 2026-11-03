import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../../../../../lib/productsApi';
import ProductDetailView from './ProductDetailView';

const product: Product = {
  id: 'p1',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
  note: 'Warm Neutrals',
};

describe('ProductDetailView', () => {
  it('shows the category, the status and the note', () => {
    render(<ProductDetailView product={product} />);
    expect(screen.getByText('Category').nextElementSibling).toHaveTextContent(
      'Makeup',
    );
    expect(screen.getByText('Status').nextElementSibling).toHaveTextContent(
      'New',
    );
    expect(screen.getByText('Note').nextElementSibling).toHaveTextContent(
      'Warm Neutrals',
    );
  });

  it('says there is no note when it is missing', () => {
    render(<ProductDetailView product={{ ...product, note: null }} />);
    expect(screen.getByText('Note').nextElementSibling).toHaveTextContent(
      'No note',
    );
  });

  it('is a region the keyboard can reach and scroll', () => {
    render(<ProductDetailView product={product} />);
    expect(
      screen.getByRole('region', { name: 'Product details' }),
    ).toHaveAttribute('tabindex', '0');
  });

  it('shows the feedback under the details only when there is one', () => {
    const { rerender } = render(<ProductDetailView product={product} />);
    expect(screen.queryByText('Updated')).not.toBeInTheDocument();

    rerender(<ProductDetailView product={product} feedback={<p>Updated</p>} />);
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
