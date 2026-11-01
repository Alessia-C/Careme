import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './apiFetch';
import { createProduct, type ProductInput } from './productsApi';

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
