import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthSessionMissingError } from '@supabase/supabase-js';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  getAccessToken,
  getBearerToken,
  getSessionCookieName,
  withAuth,
} from './auth.js';
import { withSentry } from './sentry.js';
import { makeReq, makeRes, stubSupabaseEnv } from './test-helpers.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { getUser, rpc, single, from, createClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
}));

// Only createClient is faked: withAuth also needs the real
// isAuthApiError / isAuthSessionMissingError to recognize the error classes.
vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const handler = vi.fn();
const validHeaders = { authorization: 'Bearer valid-token' };

async function callWithAuth(
  headers: Record<string, string> = validHeaders,
  cookies: Record<string, string> = {},
) {
  const { res, asVercel } = makeRes();
  // Wrapped like a real route: withSentry turns the errors that withAuth
  // rethrows into a generic 500.
  await withSentry(withAuth(handler))(
    makeReq('GET', undefined, headers, cookies),
    asVercel,
  );
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  // from('profiles').select('role').eq('id', ...).single() chain.
  const query = { select: vi.fn(), eq: vi.fn(), single };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  from.mockReturnValue(query);
  createClient.mockReturnValue({ auth: { getUser }, rpc, from });
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
  single.mockResolvedValue({ data: { role: 'user' }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('auth', () => {
  it('returns the token when the header has the Bearer prefix', () => {
    const req = makeReq('GET', undefined, { authorization: 'Bearer token' });
    const token = getBearerToken(req);
    expect(token).toBe('token');
  });

  it('returns undefined when the prefix is missing', () => {
    const req = makeReq('GET', undefined, { authorization: 'token' });
    const token = getBearerToken(req);
    expect(token).toBeUndefined();
  });

  it('returns undefined when the token is missing', () => {
    const req = makeReq('GET', undefined, { authorization: 'Bearer ' });
    const token = getBearerToken(req);
    expect(token).toBeUndefined();
  });

  it('returns undefined when the header is missing', () => {
    const req = makeReq('GET', undefined, {});
    const token = getBearerToken(req);
    expect(token).toBeUndefined();
  });

  it('preserves the token casing', () => {
    const req = makeReq('GET', undefined, {
      authorization: 'Bearer AbC.dEf.GhI',
    });
    const token = getBearerToken(req);
    expect(token).toBe('AbC.dEf.GhI');
  });
});

describe('getAccessToken', () => {
  it('reads the token from the session cookie', () => {
    const req = makeReq(
      'GET',
      undefined,
      {},
      { [getSessionCookieName()]: 'jwt' },
    );
    expect(getAccessToken(req)).toBe('jwt');
  });

  it('prefers the Authorization header over the cookie', () => {
    const req = makeReq('GET', undefined, validHeaders, {
      [getSessionCookieName()]: 'cookie-jwt',
    });
    expect(getAccessToken(req)).toBe('valid-token');
  });

  it('returns undefined when neither header nor cookie are present', () => {
    expect(getAccessToken(makeReq('GET'))).toBeUndefined();
  });

  it('ignores an empty cookie', () => {
    const req = makeReq('GET', undefined, {}, { [getSessionCookieName()]: '' });
    expect(getAccessToken(req)).toBeUndefined();
  });
});

describe('buildSessionCookie', () => {
  it('is HttpOnly, SameSite=Strict and Secure with the given lifetime', () => {
    expect(buildSessionCookie('jwt', 3600)).toBe(
      '__Host-sb-access-token=jwt; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600; Secure',
    );
  });

  it('drops Secure and the __Host- prefix under vercel dev (plain http)', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    const cookie = buildSessionCookie('jwt', 3600);
    expect(cookie).not.toContain('Secure');
    expect(cookie.startsWith('sb-access-token=jwt;')).toBe(true);
  });

  it('reads the cookie under the same name it sets', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    const req = makeReq('GET', undefined, {}, { 'sb-access-token': 'jwt' });
    expect(getAccessToken(req)).toBe('jwt');
  });
});

describe('buildClearedSessionCookie', () => {
  it('expires the cookie with the same attributes as the session cookie', () => {
    expect(buildClearedSessionCookie()).toBe(
      '__Host-sb-access-token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure',
    );
  });

  it('uses the plain cookie name under vercel dev (plain http)', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    expect(buildClearedSessionCookie()).toBe(
      'sb-access-token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    );
  });
});

describe('withAuth - token', () => {
  it.each([
    ['is missing', {}],
    ['has no Bearer prefix', { authorization: 'valid-token' }],
    ['has an empty token', { authorization: 'Bearer ' }],
  ])(
    'should return 401 when the authorization header %s',
    async (_label, headers) => {
      const res = await callWithAuth(headers);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Missing or invalid authorization header',
      });
      expect(getUser).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['an already revoked session', new AuthSessionMissingError()],
    [
      'an expired or invalid JWT',
      new AuthApiError('invalid JWT', 401, 'bad_jwt'),
    ],
    ['a forbidden session', new AuthApiError('forbidden', 403, 'not_admin')],
    [
      'a user that no longer exists',
      new AuthApiError('not found', 404, 'user_not_found'),
    ],
  ])('should return 401 when Supabase reports %s', async (_label, error) => {
    getUser.mockResolvedValue({ data: { user: null }, error });

    const res = await callWithAuth();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Session expired or invalid',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(['over_request_rate_limit', 'over_email_send_rate_limit'])(
    'should return 429 when Supabase reports %s',
    async (code) => {
      getUser.mockResolvedValue({ data: { user: null }, error: { code } });

      const res = await callWithAuth();

      expect(res.status).toHaveBeenCalledWith(429);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it('should verify the token sent by the client', async () => {
    await callWithAuth();

    expect(getUser).toHaveBeenCalledWith('valid-token');
  });

  it('should accept the token from the session cookie', async () => {
    await callWithAuth({}, { [getSessionCookieName()]: 'cookie-jwt' });

    expect(getUser).toHaveBeenCalledWith('cookie-jwt');
    expect(handler).toHaveBeenCalled();
  });
});

describe('withAuth - account and role', () => {
  it('should return 403 and skip the handler when the user is blocked', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callWithAuth();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account blocked' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should pass the id and the role read from the database to the handler', async () => {
    single.mockResolvedValue({ data: { role: 'admin' }, error: null });

    await callWithAuth();

    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      id: 'user-1',
      role: 'admin',
    });
  });

  it('should ignore a role sent by the client', async () => {
    await callWithAuth({ ...validHeaders, 'x-role': 'admin' });

    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      id: 'user-1',
      role: 'user',
    });
  });
});

describe('withAuth - unexpected failures', () => {
  it('should return a generic 500 when Supabase fails unexpectedly', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('db down', 500, 'unexpected_failure'),
    });

    const res = await callWithAuth();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return a generic 500 when the status check fails', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    const res = await callWithAuth();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return a generic 500 when the profile cannot be read', async () => {
    single.mockResolvedValue({ data: null, error: new Error('no profile') });

    const res = await callWithAuth();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return a generic 500 when the role is not a known value', async () => {
    single.mockResolvedValue({ data: { role: 'superuser' }, error: null });

    const res = await callWithAuth();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(handler).not.toHaveBeenCalled();
  });
});
