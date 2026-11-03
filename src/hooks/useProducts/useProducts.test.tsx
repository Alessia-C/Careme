import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS_PAGE_SIZE, useProducts } from './useProducts';

const makeProducts = (count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${start + index}`,
    name: `Product ${start + index}`,
    brand: 'MAC',
    category: 'makeup',
    status: 'new',
  }));

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

const renderProducts = (search = '') => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ term }) => useProducts(term), {
    wrapper,
    initialProps: { term: search },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useProducts', () => {
  it('loads the first page', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ products: makeProducts(2), total: 2 }),
    );
    const { result } = renderProducts();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/products?offset=0&limit=${PRODUCTS_PAGE_SIZE}`,
      undefined,
    );
    expect(result.current.products).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('sends the search term', async () => {
    const fetchMock = mockFetch(jsonResponse({ products: [], total: 0 }));
    const { result } = renderProducts('serum');

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/products?offset=0&limit=${PRODUCTS_PAGE_SIZE}&search=serum`,
      undefined,
    );
  });

  it('loads the next page after the ones already loaded', async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        products: makeProducts(PRODUCTS_PAGE_SIZE),
        total: PRODUCTS_PAGE_SIZE + 3,
      }),
      jsonResponse({
        products: makeProducts(3, PRODUCTS_PAGE_SIZE),
        total: PRODUCTS_PAGE_SIZE + 3,
      }),
    );
    const { result } = renderProducts();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(() => result.current.fetchNextPage());

    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/products?offset=${PRODUCTS_PAGE_SIZE}&limit=${PRODUCTS_PAGE_SIZE}`,
      undefined,
    );
    await waitFor(() =>
      expect(result.current.products).toHaveLength(PRODUCTS_PAGE_SIZE + 3),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('shows a product that comes in two pages only once', async () => {
    mockFetch(
      jsonResponse({
        products: makeProducts(PRODUCTS_PAGE_SIZE),
        total: PRODUCTS_PAGE_SIZE + 2,
      }),
      // A product created in between pushed p11 to the second page.
      jsonResponse({
        products: makeProducts(2, PRODUCTS_PAGE_SIZE - 1),
        total: PRODUCTS_PAGE_SIZE + 2,
      }),
    );
    const { result } = renderProducts();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(() => result.current.fetchNextPage());

    await waitFor(() =>
      expect(result.current.products).toHaveLength(PRODUCTS_PAGE_SIZE + 1),
    );
    const ids = result.current.products.map((product) => product.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('enters the error state when the request fails', async () => {
    mockFetch(
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
    );
    const { result } = renderProducts();

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 3000,
    });

    expect(result.current.products).toEqual([]);
  });

  it('keeps the previous list while a new search loads', async () => {
    mockFetch(
      jsonResponse({ products: makeProducts(2), total: 2 }),
      jsonResponse({ products: makeProducts(1), total: 1 }),
    );
    const { result, rerender } = renderProducts();
    await waitFor(() => expect(result.current.products).toHaveLength(2));

    rerender({ term: 'palette' });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.products).toHaveLength(2);
    await waitFor(() => expect(result.current.products).toHaveLength(1));
  });

  it('does not ask the API again on window focus or reconnect', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ products: makeProducts(1), total: 1 }),
    );
    const { result } = renderProducts();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    fetchMock.mockClear();

    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
