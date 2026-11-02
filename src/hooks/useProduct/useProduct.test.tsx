import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProduct } from './useProduct';

const product = {
  id: 'p1',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
  note: 'Warm Neutrals',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const mockFetch = (...responses: Response[]) => {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(() => Promise.resolve(response));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderProduct = (id: string | null) => {
  // No wait between the attempts, so a retry does not slow the test down.
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ productId }) => useProduct(productId), {
    wrapper,
    initialProps: { productId: id },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useProduct', () => {
  it('loads the product', async () => {
    const fetchMock = mockFetch(jsonResponse({ product }));
    const { result } = renderProduct('p1');

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith('/api/products/p1', undefined);
    expect(result.current.product).toEqual(product);
    expect(result.current.isError).toBe(false);
  });

  it('asks for nothing without an id', () => {
    const fetchMock = mockFetch();
    const { result } = renderProduct(null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.product).toBeUndefined();
  });

  it('asks again when the id changes', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ product }),
      jsonResponse({ product: { ...product, id: 'p2', name: 'Serum' } }),
    );
    const { result, rerender } = renderProduct('p1');
    await waitFor(() => expect(result.current.product?.id).toBe('p1'));

    rerender({ productId: 'p2' });

    await waitFor(() => expect(result.current.product?.name).toBe('Serum'));
    expect(fetchMock).toHaveBeenCalledWith('/api/products/p2', undefined);
  });

  it('does not retry a product that is not found', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 404 }));
    const { result } = renderProduct('p1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isNotFound).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once after a server error', async () => {
    const fetchMock = mockFetch(
      new Response(null, { status: 500 }),
      jsonResponse({ product }),
    );
    const { result } = renderProduct('p1');

    await waitFor(() => expect(result.current.product).toEqual(product));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a server error that persists, which is not a missing product', async () => {
    const fetchMock = mockFetch(
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
    );
    const { result } = renderProduct('p1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isNotFound).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an expired session', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 401 }));
    const { result } = renderProduct('p1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isNotFound).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again from refetch', async () => {
    const fetchMock = mockFetch(
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
      jsonResponse({ product }),
    );
    const { result } = renderProduct('p1');
    await waitFor(() => expect(result.current.isError).toBe(true));

    await result.current.refetch();

    await waitFor(() => expect(result.current.product).toEqual(product));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
