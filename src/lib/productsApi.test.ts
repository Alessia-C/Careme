import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './apiFetch';
import {
  addProduct,
  createProduct,
  findDuplicate,
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

describe('findDuplicate', () => {
  it('asks for the trimmed name and brand, one result only', async () => {
    const fetchMock = mockFetch(jsonResponse({ products: [], total: 0 }));

    await findDuplicate('  Eye Palette ', ' MAC  ');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products?name=Eye+Palette&brand=MAC&limit=1',
      undefined,
    );
  });

  it('encodes characters that have a meaning in a URL', async () => {
    const fetchMock = mockFetch(jsonResponse({ products: [], total: 0 }));

    await findDuplicate('Serum (30ml) & co, 50%', "L'Oréal");

    const [url] = fetchMock.mock.calls[0];
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.get('name')).toBe('Serum (30ml) & co, 50%');
    expect(params.get('brand')).toBe("L'Oréal");
  });

  it('reports a duplicate when the first product has the same name and brand', async () => {
    mockFetch(
      jsonResponse({
        products: [{ id: '1', name: 'Eye Palette', brand: 'MAC' }],
        total: 1,
      }),
    );
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: true,
      duplicate: true,
    });
  });

  it('reports no duplicate when nothing matches', async () => {
    mockFetch(jsonResponse({ products: [], total: 0 }));
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: true,
      duplicate: false,
    });
  });

  it('does not report a duplicate when the filters are ignored and an unrelated product comes back', async () => {
    mockFetch(
      jsonResponse({
        products: [{ id: '2', name: 'Cleansing Oil', brand: 'Shiseido' }],
        total: 7,
      }),
    );
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: true,
      duplicate: false,
    });
  });

  it('does not report a duplicate when only the name matches', async () => {
    mockFetch(
      jsonResponse({
        products: [{ id: '3', name: 'Eye Palette', brand: 'Dior' }],
        total: 1,
      }),
    );
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: true,
      duplicate: false,
    });
  });

  it('fails on a malformed body', async () => {
    mockFetch(new Response('not json', { status: 200 }));
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('reports the rate limit on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });

  it('fails on a server error', async () => {
    mockFetch(new Response(null, { status: 500 }));
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('fails on a network error', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await findDuplicate('Eye Palette', 'MAC')).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('lets an expired session through as UnauthorizedError', async () => {
    mockFetch(new Response(null, { status: 401 }));
    await expect(findDuplicate('Eye Palette', 'MAC')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
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

describe('addProduct', () => {
  it('creates the product when there is no duplicate', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ products: [], total: 0 }),
      jsonResponse({ product: {} }, 201),
    );

    expect(await addProduct(input)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/products');
  });

  it('does not create anything when the product already exists', async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        products: [{ id: '1', name: 'Eye Palette', brand: 'MAC' }],
        total: 1,
      }),
    );

    expect(await addProduct(input)).toEqual({ ok: false, reason: 'duplicate' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not create anything when the check fails', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 500 }));

    expect(await addProduct(input)).toEqual({ ok: false, reason: 'failed' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a failed creation', async () => {
    mockFetch(
      jsonResponse({ products: [], total: 0 }),
      new Response(null, { status: 500 }),
    );
    expect(await addProduct(input)).toEqual({ ok: false, reason: 'failed' });
  });
});
