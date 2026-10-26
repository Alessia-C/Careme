import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { makeReq, makeRes, stubSupabaseEnv } from '../_lib/test-helpers.js';
import {
  buildClearedRefreshCookie,
  buildClearedSessionCookie,
  getRefreshCookieName,
  getSessionCookieName,
} from '../_lib/auth.js';
import handler from './refresh.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { refreshSession, signOut, rpc, createClient, captureException } =
  vi.hoisted(() => ({
    captureException: vi.fn(),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
    rpc: vi.fn(),
    createClient: vi.fn(),
  }));

// Sentry is faked to check what is reported without sending anything.
vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  captureException,
  flush: vi.fn(),
}));

// Only createClient is faked: the handler also needs the real isAuthApiError
// to recognize the error class.
vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const session = {
  access_token: 'new-access-jwt',
  refresh_token: 'new-refresh-token',
  expires_in: 3600,
  expires_at: 1790000000,
};

const validCookies = {
  [getRefreshCookieName()]: 'old-refresh-token',
  [getSessionCookieName()]: 'old-access-jwt',
};

const clearedCookies = [
  buildClearedSessionCookie(),
  buildClearedRefreshCookie(),
];

async function callHandler(
  method: string,
  cookies: Record<string, string> = validCookies,
) {
  const { res, asVercel } = makeRes();
  await handler(makeReq(method, {}, {}, cookies), asVercel);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  createClient.mockReturnValue({
    auth: { refreshSession, admin: { signOut } },
    rpc,
  });
  signOut.mockResolvedValue({ error: null });
  refreshSession.mockResolvedValue({
    data: { user: { id: 'user-1' }, session },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/refresh - request shape', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(405);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('should return 415 when the body is not JSON', async () => {
    const { res, asVercel } = makeRes();
    await handler(
      makeReq('POST', {}, { 'content-type': 'text/plain' }, validCookies),
      asVercel,
    );

    expect(res.status).toHaveBeenCalledWith(415);
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/refresh - successful refresh', () => {
  it('should exchange the cookie value for a new session', async () => {
    await callHandler('POST');

    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: 'old-refresh-token',
    });
  });

  it('should return 200 with the new expiry and no tokens in the body', async () => {
    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ expires_at: 1790000000 });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('new-');
  });

  it('should rotate both cookies in a single header', async () => {
    const res = await callHandler('POST');

    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [
      expect.stringMatching(
        /^__Host-sb-access-token=new-access-jwt; HttpOnly; SameSite=Strict; Path=\/; Max-Age=3600/,
      ),
      expect.stringMatching(
        /^__Secure-sb-refresh-token=new-refresh-token; HttpOnly; SameSite=Strict; Path=\/api\/auth/,
      ),
    ]);
  });

  it('should forbid caching the response', async () => {
    const res = await callHandler('POST');

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('should check the profile status with the new JWT', async () => {
    await callHandler('POST');

    expect(createClient).toHaveBeenLastCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer new-access-jwt' } },
      }),
    );
    expect(rpc).toHaveBeenCalledWith('is_active');
  });
});

describe('POST /api/auth/refresh - session ended', () => {
  it('should return 401 and clear both cookies when the refresh cookie is missing', async () => {
    const res = await callHandler('POST', {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('should return 401 and clear both cookies when the access cookie is gone', async () => {
    // The refresh cookie may outlive the browser; the access cookie expires
    // with the access token, which ends the inactivity window.
    const res = await callHandler('POST', {
      [getRefreshCookieName()]: 'old-refresh-token',
    });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown', new AuthApiError('not found', 400, 'refresh_token_not_found')],
    [
      'already used',
      new AuthApiError('used', 400, 'refresh_token_already_used'),
    ],
    ['rejected', new AuthApiError('invalid', 401, 'bad_jwt')],
  ])(
    'should return 401 and clear both cookies when the refresh token is %s',
    async (_label, error) => {
      refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error,
      });

      const res = await callHandler('POST');

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
    },
  );

  it('should return 403, clear both cookies and set no session for a blocked account', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account blocked' });
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
    expect(JSON.stringify(res.setHeader.mock.calls)).not.toContain('new-');
  });

  it('should revoke the session it just created for a blocked account', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await callHandler('POST');

    expect(signOut).toHaveBeenCalledWith('new-access-jwt', 'local');
  });

  it('should still return 403 when revoking the blocked account session fails', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    signOut.mockResolvedValue({ error: new Error('revoke failed') });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', clearedCookies);
  });

  it('should report a failed revoke to Sentry', async () => {
    const failure = new Error('revoke failed');
    rpc.mockResolvedValue({ data: false, error: null });
    signOut.mockResolvedValue({ error: failure });

    await callHandler('POST');

    expect(captureException).toHaveBeenCalledWith(failure, expect.anything());
  });

  it('should not revoke anything for an active account', async () => {
    await callHandler('POST');

    expect(signOut).not.toHaveBeenCalled();
  });

  it('should treat a null status as blocked', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('POST /api/auth/refresh - transient failures', () => {
  it.each(['over_request_rate_limit', 'over_email_send_rate_limit'])(
    'should return 429 and keep the cookies when Supabase reports %s',
    async (code) => {
      refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error: { code },
      });

      const res = await callHandler('POST');

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Set-Cookie',
        expect.anything(),
      );
    },
  );

  it('should return a generic 500 and keep the cookies when Supabase fails', async () => {
    refreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('db down', 500, 'unexpected_failure'),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Set-Cookie',
      expect.anything(),
    );
  });

  it('should return a generic 500 when the status check fails', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.setHeader.mock.calls)).not.toContain('new-');
  });

  it('should return a generic 500 when Supabase returns no session', async () => {
    refreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
