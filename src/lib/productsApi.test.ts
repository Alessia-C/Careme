import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './apiFetch';
import { createProduct, listProducts, type ProductInput } from './productsApi';

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
