import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, UnauthorizedError } from './apiFetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('returns the response when the request succeeds', async () => {
    const response = new Response('{}', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/products', { method: 'GET' })).resolves.toBe(
      response,
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/products', {
      method: 'GET',
    });
  });

  it('throws UnauthorizedError on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(apiFetch('/api/products')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it.each([400, 403, 404, 500])('leaves a %i to the caller', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status })),
    );

    const response = await apiFetch('/api/products');

    expect(response.status).toBe(status);
  });
});
