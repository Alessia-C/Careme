import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthSessionMissingError } from '@supabase/supabase-js';
import { makeReq, makeRes, stubSupabaseEnv } from '../_lib/test-helpers.js';
import { buildClearedSessionCookie } from '../_lib/auth.js';
import handler from './logout.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { signOut, createClient } = vi.hoisted(() => ({
  signOut: vi.fn(),
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
  await handler(makeReq(method, undefined, headers, cookies), asVercel);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  createClient.mockReturnValue({ auth: { admin: { signOut } } });
  signOut.mockResolvedValue({ data: null, error: null });
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
      expect(res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        buildClearedSessionCookie(),
      );
    },
  );
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

  it('should clear the session cookie on success', async () => {
    const res = await callHandler('POST', validHeaders);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      buildClearedSessionCookie(),
    );
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
    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      buildClearedSessionCookie(),
    );
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
      // The session is still alive: keep the cookie so the user can retry.
      expect(res.setHeader).not.toHaveBeenCalled();
    },
  );
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
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('should return a generic 500 when the Supabase env vars are missing', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const res = await callHandler('POST', validHeaders);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(signOut).not.toHaveBeenCalled();
  });
});
