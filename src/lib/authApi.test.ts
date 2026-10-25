import { afterEach, describe, expect, it, vi } from 'vitest';
import { signup } from './authApi';

const input = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  password: 'Str0ng!pass',
};

const mockFetch = (response: Response | Error) => {
  const fetchMock = vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('signup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts only the four signup fields as JSON', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 201 }));

    await signup(input);

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('returns ok on 201', async () => {
    mockFetch(new Response(null, { status: 201 }));
    expect(await signup(input)).toEqual({ ok: true });
  });

  it('returns rate-limited on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await signup(input)).toEqual({ ok: false, reason: 'rate-limited' });
  });

  it.each([400, 500])('returns failed on %i', async (status) => {
    mockFetch(new Response(null, { status }));
    expect(await signup(input)).toEqual({ ok: false, reason: 'failed' });
  });

  it('returns failed when the network is down', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await signup(input)).toEqual({ ok: false, reason: 'failed' });
  });
});
