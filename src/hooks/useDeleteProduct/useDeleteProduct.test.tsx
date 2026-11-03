import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  productDetailKey,
  PRODUCTS_LIST_QUERY_KEY,
} from '../../lib/productsApi';
import { useDeleteProduct } from './useDeleteProduct';

const mockFetch = (...responses: Response[]) => {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(() => Promise.resolve(response));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderDelete = (onDeleted = vi.fn()) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useDeleteProduct(onDeleted), { wrapper });
  return { ...view, client, onDeleted };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDeleteProduct', () => {
  it('deletes the product, drops its detail and refreshes the list', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));
    const { result, client, onDeleted } = renderDelete();
    client.setQueryData(productDetailKey('p1'), { id: 'p1' });
    client.setQueryData([...PRODUCTS_LIST_QUERY_KEY, ''], { pages: [] });

    act(() => result.current.remove('p1'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/products/p1', {
      method: 'DELETE',
    });
    expect(client.getQueryData(productDetailKey('p1'))).toBeUndefined();
    expect(
      client.getQueryState([...PRODUCTS_LIST_QUERY_KEY, ''])?.isInvalidated,
    ).toBe(true);
  });

  it('exposes the reason of a failure and does not report a deletion', async () => {
    mockFetch(new Response(null, { status: 500 }));
    const { result, onDeleted } = renderDelete();

    act(() => result.current.remove('p1'));

    await waitFor(() => expect(result.current.errorReason).toBe('failed'));
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('clears the failure on reset', async () => {
    mockFetch(new Response(null, { status: 429 }));
    const { result } = renderDelete();

    act(() => result.current.remove('p1'));
    await waitFor(() =>
      expect(result.current.errorReason).toBe('rate-limited'),
    );
    act(() => result.current.reset());

    await waitFor(() => expect(result.current.errorReason).toBeNull());
  });

  it('ignores a second delete while one is running', async () => {
    let finish: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result, onDeleted } = renderDelete();

    act(() => result.current.remove('p1'));
    await waitFor(() => expect(result.current.isDeleting).toBe(true));
    act(() => result.current.remove('p1'));
    finish(new Response(null, { status: 204 }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
