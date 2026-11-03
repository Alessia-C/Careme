import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './apiFetch';
import {
  cacheUpdatedProduct,
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  PRODUCTS_LIST_QUERY_KEY,
  productDetailKey,
  updateProduct,
  type Product,
  type ProductInput,
} from './productsApi';

const input: ProductInput = {
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
  note: '',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const mockFetch = (...responses: Array<Response | Error>) => {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(() =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response),
    );
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createProduct', () => {
  it('posts the product as JSON', async () => {
    const fetchMock = mockFetch(jsonResponse({ product: {} }, 201));

    await createProduct(input);

    expect(fetchMock).toHaveBeenCalledWith('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('returns ok on 201', async () => {
    mockFetch(jsonResponse({ product: {} }, 201));
    expect(await createProduct(input)).toEqual({ ok: true });
  });

  it('reports the rate limit on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await createProduct(input)).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });

  it.each([400, 403, 500])('fails on a %i', async (status) => {
    mockFetch(new Response(null, { status }));
    expect(await createProduct(input)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('fails on a network error', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await createProduct(input)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('lets an expired session through as UnauthorizedError', async () => {
    mockFetch(new Response(null, { status: 401 }));
    await expect(createProduct(input)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe('listProducts', () => {
  const page = {
    products: [
      {
        id: 'p1',
        name: 'Eye Palette',
        brand: 'MAC',
        category: 'makeup',
        status: 'new',
      },
    ],
    total: 1,
  };

  it('asks for the page with offset and limit', async () => {
    const fetchMock = mockFetch(jsonResponse(page));

    await listProducts({ search: '', offset: 12, limit: 12 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products?offset=12&limit=12',
      undefined,
    );
  });

  it('sends the search term, encoded', async () => {
    const fetchMock = mockFetch(jsonResponse(page));

    await listProducts({ search: 'eye & lip', offset: 0, limit: 12 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products?offset=0&limit=12&search=eye+%26+lip',
      undefined,
    );
  });

  it('returns the products and the total', async () => {
    mockFetch(jsonResponse({ ...page, total: 30 }));
    expect(await listProducts({ search: '', offset: 0, limit: 12 })).toEqual({
      ok: true,
      products: page.products,
      total: 30,
    });
  });

  it('reports the rate limit on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await listProducts({ search: '', offset: 0, limit: 12 })).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });

  it.each([400, 403, 500])('fails on a %i', async (status) => {
    mockFetch(new Response(null, { status }));
    expect(await listProducts({ search: '', offset: 0, limit: 12 })).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('fails on a network error', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await listProducts({ search: '', offset: 0, limit: 12 })).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it.each([
    ['not JSON', new Response('<html></html>', { status: 200 })],
    ['not a page', jsonResponse({ products: 'none' })],
    ['a page with a null item', jsonResponse({ products: [null], total: 1 })],
    [
      'a page with an unknown category',
      jsonResponse({
        products: [{ ...page.products[0], category: 'hair' }],
        total: 1,
      }),
    ],
    [
      'a page with an item without a name',
      jsonResponse({
        products: [{ ...page.products[0], name: undefined }],
        total: 1,
      }),
    ],
  ])('fails when the body is %s', async (_name, response) => {
    mockFetch(response);
    expect(await listProducts({ search: '', offset: 0, limit: 12 })).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('lets an expired session through as UnauthorizedError', async () => {
    mockFetch(new Response(null, { status: 401 }));
    await expect(
      listProducts({ search: '', offset: 0, limit: 12 }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('getProduct', () => {
  const product = {
    id: 'p1',
    name: 'Eye Palette',
    brand: 'MAC',
    category: 'makeup',
    status: 'new',
    note: 'Warm Neutrals',
  };

  it('asks for the product by its encoded id', async () => {
    const fetchMock = mockFetch(jsonResponse({ product }));

    await getProduct('a/b c');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/a%2Fb%20c',
      undefined,
    );
  });

  it('returns the product', async () => {
    mockFetch(jsonResponse({ product }));
    expect(await getProduct('p1')).toEqual({ ok: true, product });
  });

  it('accepts a product without a note', async () => {
    mockFetch(jsonResponse({ product: { ...product, note: null } }));
    expect(await getProduct('p1')).toEqual({
      ok: true,
      product: { ...product, note: null },
    });
  });

  it.each([403, 404])('reports not found on a %i', async (status) => {
    mockFetch(new Response(null, { status }));
    expect(await getProduct('p1')).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('reports the rate limit on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await getProduct('p1')).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });

  it('fails on a 500', async () => {
    mockFetch(new Response(null, { status: 500 }));
    expect(await getProduct('p1')).toEqual({ ok: false, reason: 'failed' });
  });

  it('fails on a network error', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await getProduct('p1')).toEqual({ ok: false, reason: 'failed' });
  });

  it.each([
    ['an HTML fallback', new Response('<html></html>', { status: 200 })],
    ['a body without the product', jsonResponse({})],
    ['a product without its name', jsonResponse({ product: { id: 'p1' } })],
    [
      'a note that is not text',
      jsonResponse({ product: { ...product, note: 5 } }),
    ],
    [
      'an unknown category',
      jsonResponse({ product: { ...product, category: 'hair' } }),
    ],
  ])('fails on %s', async (_label, response) => {
    mockFetch(response);
    expect(await getProduct('p1')).toEqual({ ok: false, reason: 'failed' });
  });

  it('lets an expired session through as UnauthorizedError', async () => {
    mockFetch(new Response(null, { status: 401 }));
    await expect(getProduct('p1')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('updateProduct', () => {
  const product: Product = {
    id: 'p1',
    name: 'Eye Palette',
    brand: 'MAC',
    category: 'makeup',
    status: 'new',
    note: null,
  };

  it('puts the product as JSON to its encoded id', async () => {
    const fetchMock = mockFetch(jsonResponse({ product }));

    await updateProduct('a/b c', input);

    expect(fetchMock).toHaveBeenCalledWith('/api/products/a%2Fb%20c', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('returns the updated product', async () => {
    mockFetch(jsonResponse({ product }));
    expect(await updateProduct('p1', input)).toEqual({ ok: true, product });
  });

  it.each([404, 403])('reports not found on a %i', async (status) => {
    mockFetch(new Response(null, { status }));
    expect(await updateProduct('p1', input)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('reports the rate limit on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await updateProduct('p1', input)).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });

  it.each([400, 500])('fails on a %i', async (status) => {
    mockFetch(new Response(null, { status }));
    expect(await updateProduct('p1', input)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('fails on a network error', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await updateProduct('p1', input)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it.each([
    ['an HTML fallback', new Response('<html></html>', { status: 200 })],
    ['a body without the product', jsonResponse({})],
    ['a product without its name', jsonResponse({ product: { id: 'p1' } })],
  ])('fails on %s', async (_label, response) => {
    mockFetch(response);
    expect(await updateProduct('p1', input)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('lets an expired session through as UnauthorizedError', async () => {
    mockFetch(new Response(null, { status: 401 }));
    await expect(updateProduct('p1', input)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe('cacheUpdatedProduct', () => {
  const product: Product = {
    id: 'p1',
    name: 'New name',
    brand: 'MAC',
    category: 'makeup',
    status: 'used',
    note: 'Warm Neutrals',
  };

  it('writes the product in its detail', () => {
    const queryClient = new QueryClient();

    cacheUpdatedProduct(queryClient, product);

    expect(queryClient.getQueryData(productDetailKey('p1'))).toEqual(product);
  });

  it('refreshes the lists and leaves the detail alone', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    cacheUpdatedProduct(queryClient, product);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: PRODUCTS_LIST_QUERY_KEY,
    });
  });

  it('cancels a request for the detail that is still on its way', () => {
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, 'cancelQueries');

    cacheUpdatedProduct(queryClient, product);

    expect(cancel).toHaveBeenCalledWith({
      queryKey: productDetailKey('p1'),
    });
  });
});

describe('deleteProduct', () => {
  it('sends a DELETE with the encoded id', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await deleteProduct('a/b');

    expect(fetchMock).toHaveBeenCalledWith('/api/products/a%2Fb', {
      method: 'DELETE',
    });
  });

  it('returns ok on 204', async () => {
    mockFetch(new Response(null, { status: 204 }));
    expect(await deleteProduct('p1')).toEqual({ ok: true });
  });

  it('treats a 404 as deleted', async () => {
    mockFetch(new Response(null, { status: 404 }));
    expect(await deleteProduct('p1')).toEqual({ ok: true });
  });

  it('reports the rate limit on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await deleteProduct('p1')).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });

  it('fails on a 500', async () => {
    mockFetch(new Response(null, { status: 500 }));
    expect(await deleteProduct('p1')).toEqual({ ok: false, reason: 'failed' });
  });

  it('ends the session on a 403 (blocked account)', async () => {
    mockFetch(new Response(null, { status: 403 }));
    await expect(deleteProduct('p1')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('fails on a network error', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await deleteProduct('p1')).toEqual({ ok: false, reason: 'failed' });
  });

  it('lets an expired session through as UnauthorizedError', async () => {
    mockFetch(new Response(null, { status: 401 }));
    await expect(deleteProduct('p1')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
