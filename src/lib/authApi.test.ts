import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, signup } from './authApi';

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

describe('login', () => {
  const credentials = { email: 'jane@example.com', password: 'secret' };
  const loginBody = {
    message: 'Login successful',
    user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts only email and password as JSON', async () => {
    const fetchMock = mockFetch(Response.json(loginBody));

    await login(credentials);

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
  });

  it('returns the user and role on 200', async () => {
    mockFetch(Response.json(loginBody));

    expect(await login(credentials)).toEqual({
      ok: true,
      user: { id: 'user-1', email: 'jane@example.com' },
      role: 'user',
    });
  });

  it.each([400, 403])(
    'returns the same invalid-credentials reason on %i',
    async (status) => {
      mockFetch(new Response(null, { status }));
      expect(await login(credentials)).toEqual({
        ok: false,
        reason: 'invalid-credentials',
      });
    },
  );

  it('returns rate-limited on 429', async () => {
    mockFetch(new Response(null, { status: 429 }));
    expect(await login(credentials)).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });

  it('returns failed on 500', async () => {
    mockFetch(new Response(null, { status: 500 }));
    expect(await login(credentials)).toEqual({ ok: false, reason: 'failed' });
  });

  it.each([
    ['an unknown role', { user: { id: 'u', email: 'e', role: 'root' } }],
    ['a missing user', {}],
  ])('returns failed on 200 with %s', async (_label, body) => {
    mockFetch(Response.json(body));
    expect(await login(credentials)).toEqual({ ok: false, reason: 'failed' });
  });

  it('returns failed when the body is not JSON', async () => {
    mockFetch(new Response('oops', { status: 200 }));
    expect(await login(credentials)).toEqual({ ok: false, reason: 'failed' });
  });

  it('returns failed when the network is down', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await login(credentials)).toEqual({ ok: false, reason: 'failed' });
  });
});
