import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductListItem } from '../../../../lib/productsApi';
import DeleteProductModal from './DeleteProductModal';

const product: ProductListItem = {
  id: 'p1',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
};

const mockFetch = (...responses: Array<Response | Promise<Response>>) => {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(() => Promise.resolve(response));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderModal = (
  props: { product?: ProductListItem | null } = { product },
) => {
  const onCancel = vi.fn();
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeleteProductModal
        product={props.product ?? null}
        onCancel={onCancel}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>,
  );
  return { onCancel, onDeleted };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeleteProductModal', () => {
  it('asks for confirmation with the text of the design', () => {
    renderModal();

    expect(
      screen.getByRole('alertdialog', { name: 'Delete product' }),
    ).toHaveAccessibleDescription(
      'Are you sure you want to remove this product?',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('is closed without a product', () => {
    renderModal({ product: null });
    expect(
      screen.getByRole('alertdialog', { hidden: true }),
    ).not.toHaveAttribute('open');
  });

  it('deletes the product and reports it', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));
    const { onDeleted } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/products/p1', {
      method: 'DELETE',
    });
  });

  it('calls onCancel from Cancel without deleting', async () => {
    const fetchMock = mockFetch();
    const { onCancel } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows "Deleting…" and ignores clicks while it runs', async () => {
    let finish: (response: Response) => void = () => {};
    const fetchMock = mockFetch(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const { onDeleted } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const busy = await screen.findByRole('button', { name: 'Deleting…' });
    await userEvent.click(busy);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(new Response(null, { status: 204 }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it.each([
    [429, 'Too many attempts. Please wait a moment and try again.'],
    [500, 'We couldn’t delete the product. Please try again.'],
  ])('shows the error of a %i and offers "Try again"', async (status, text) => {
    mockFetch(new Response(null, { status }));
    const { onDeleted } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
