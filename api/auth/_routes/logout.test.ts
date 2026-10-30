import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthSessionMissingError } from '@supabase/supabase-js';
import { makeReq, makeRes, stubSupabaseEnv } from '../_lib/test-helpers.js';
import {
  buildClearedRefreshCookie,
  getRefreshCookieName,
  buildClearedSessionCookie,
} from '../_lib/auth.js';

const clearedCookies = [
  buildClearedSessionCookie(),
  buildClearedRefreshCookie(),
];
import handler from './logout.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { signOut, refreshSession, createClient } = vi.hoisted(() => ({
  signOut: vi.fn(),
  refreshSession: vi.fn(),
  createClient: vi.fn(),
}));

// Only createClient is faked: the handler also needs the real
// isAuthApiError / isAuthSessionMissingError to recognize the error classes.
vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const validHeaders = { authorization: 'Bearer valid-token' };

async function callHandler(
  method: string,
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {},
) {
  const { res, asVercel } = makeRes();
  await handler(makeReq(method, {}, headers, cookies), asVercel);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  createClient.mockReturnValue({
    auth: { admin: { signOut }, refreshSession },
  });
  signOut.mockResolvedValue({ data: null, error: null });
  refreshSession.mockResolvedValue({
    data: { session: { access_token: 'renewed-access-jwt' } },
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/logout - request shape', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET', validHeaders);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([
    ['is missing', {}],
    ['has no Bearer prefix', { authorization: 'valid-token' }],
    ['has an empty token', { authorization: 'Bearer ' }],
  ])(
    'should return 401 when the authorization header %s',
    async (_label, headers) => {
      const res = await callHandler('POST', headers);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Missing or invalid authorization header',
      });
      expect(signOut).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
    },
  );
});

describe('POST /api/auth/logout - CSRF defence', () => {
  it('should return 415 when the body is not JSON', async () => {
    const { res, asVercel } = makeRes();
    await handler(
      makeReq('POST', {}, { ...validHeaders, 'content-type': 'text/plain' }),
      asVercel,
    );

    expect(res.status).toHaveBeenCalledWith(415);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('should return 400 when the JSON body is missing', async () => {
    const { res, asVercel } = makeRes();
    await handler(makeReq('POST', undefined, validHeaders), asVercel);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/logout - sign out', () => {
  it('should return 200 and revoke only the current session', async () => {
    const res = await callHandler('POST', validHeaders);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Logged out successfully',
    });
    expect(signOut).toHaveBeenCalledWith('valid-token', 'local');
  });

  it('should clear both cookies on success', async () => {
    const res = await callHandler('POST', validHeaders);

    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

  it('should read the token from the session cookie when there is no header', async () => {
    const res = await callHandler(
      'POST',
      {},
      { '__Host-sb-access-token': 'cookie-token' },
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(signOut).toHaveBeenCalledWith('cookie-token', 'local');
  });

  it('should not check the profile status, so a blocked user can log out', async () => {
    // The fake client only has auth.admin: any rpc/from call (as withAuth
    // does to reject blocked users) would throw and give a 500.
    const res = await callHandler('POST', validHeaders);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('should prefer the Authorization header over the cookie', async () => {
    await callHandler('POST', validHeaders, {
      '__Host-sb-access-token': 'cookie-token',
    });

    expect(signOut).toHaveBeenCalledWith('valid-token', 'local');
  });

  it('should clear the cookie even when the header token is the one revoked', async () => {
    const res = await callHandler('POST', validHeaders, {
      '__Host-sb-access-token': 'cookie-token',
    });

    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

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
    signOut.mockResolvedValue({ data: null, error });

    const res = await callHandler('POST', validHeaders);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Session expired or invalid',
    });
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

  it.each(['over_request_rate_limit', 'over_email_send_rate_limit'])(
    'should return 429 when Supabase reports %s',
    async (code) => {
      signOut.mockResolvedValue({ data: null, error: { code } });

      const res = await callHandler('POST', validHeaders);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Too many requests, please try again later',
      });
      // The client drops its session anyway, so the cookie goes away too.
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
    },
  );
});

describe('POST /api/auth/logout - access cookie already expired', () => {
  const refreshCookie = { [getRefreshCookieName()]: 'refresh-token' };

  it('should renew the session and revoke it, so the refresh token dies too', async () => {
    const res = await callHandler('POST', {}, refreshCookie);

    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: 'refresh-token',
    });
    expect(signOut).toHaveBeenCalledWith('renewed-access-jwt', 'local');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

  it('should fall back to the refresh cookie when the access token is already expired', async () => {
    signOut
      .mockResolvedValueOnce({
        data: null,
        error: new AuthApiError('invalid JWT', 401, 'bad_jwt'),
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const res = await callHandler('POST', validHeaders, refreshCookie);

    expect(signOut).toHaveBeenNthCalledWith(1, 'valid-token', 'local');
    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: 'refresh-token',
    });
    expect(signOut).toHaveBeenNthCalledWith(2, 'renewed-access-jwt', 'local');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 401 when the fallback finds the refresh token dead too', async () => {
    signOut.mockResolvedValue({
      data: null,
      error: new AuthApiError('invalid JWT', 401, 'bad_jwt'),
    });
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('gone', 400, 'refresh_token_not_found'),
    });

    const res = await callHandler('POST', validHeaders, refreshCookie);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should not use the refresh cookie when an access token is present', async () => {
    await callHandler('POST', validHeaders, refreshCookie);

    expect(refreshSession).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith('valid-token', 'local');
  });

  it('should return 401 when the refresh token is already dead', async () => {
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('gone', 400, 'refresh_token_not_found'),
    });

    const res = await callHandler('POST', {}, refreshCookie);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(signOut).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

  it('should return 429 when Supabase rate-limits the renewal', async () => {
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: { code: 'over_request_rate_limit' },
    });

    const res = await callHandler('POST', {}, refreshCookie);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(signOut).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

  it('should return a generic 500 and still clear the cookies when the renewal fails', async () => {
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('db down', 500, 'unexpected_failure'),
    });

    const res = await callHandler('POST', {}, refreshCookie);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });
});

describe('POST /api/auth/logout - unexpected failures', () => {
  it('should return a generic 500 when Supabase fails unexpectedly', async () => {
    signOut.mockResolvedValue({
      data: null,
      error: new AuthApiError('db down', 500, 'unexpected_failure'),
    });

    const res = await callHandler('POST', validHeaders);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

  it('should return a generic 500 when the Supabase env vars are missing', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const res = await callHandler('POST', validHeaders);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(signOut).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });
});
