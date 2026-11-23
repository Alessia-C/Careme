import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeReq,
  makeRes,
  stubSupabaseEnv,
  withErrorHandler,
} from '../../_lib/test-helpers.js';
import route from './reset.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { setSession, updateUser, signOut, rpc, createClient, captureException } =
  vi.hoisted(() => ({
    setSession: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    rpc: vi.fn(),
    createClient: vi.fn(),
    captureException: vi.fn(),
  }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

// Sentry is faked to check what is reported without sending anything.
vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  captureException,
  flush: vi.fn(),
}));

const NOW_SECONDS = 1790000000;

// Only the payload matters to the handler (the signature is verified by
// Supabase, which is faked here).
// Passing `undefined` as exp builds a token without the claim, whereas leaving
// it out gives a valid one.
function makeAccessToken(amr: unknown, ...rest: [exp?: unknown]) {
  const exp = rest.length > 0 ? rest[0] : NOW_SECONDS + 3600;
  const payload = Buffer.from(JSON.stringify({ amr, exp }));
  return `header.${payload.toString('base64url')}.signature`;
}

const recoveryAmr = (method = 'otp', timestamp = NOW_SECONDS - 60) => [
  { method, timestamp },
];

const accessToken = makeAccessToken(recoveryAmr());

const validBody = {
  accessToken,
  refreshToken: 'refresh-token',
  password: 'Valid123!',
};

// Supabase hands back the token it verified, which is the one that was sent.
function verifiedSession({
  access_token,
  refresh_token,
}: {
  access_token: string;
  refresh_token: string;
}) {
  return Promise.resolve({
    data: {
      user: { id: 'user-1', email: 'test@example.com' },
      session: { access_token, refresh_token, expires_in: 3600 },
    },
    error: null,
  });
}

const POLICY_MESSAGE = expect.stringContaining('Invalid password');
const INVALID_LINK = { message: 'Invalid or expired link' };

const handler = withErrorHandler(route);

async function callHandler(method: string, body: unknown) {
  const { res, asExpress } = makeRes();
  await handler(makeReq(method, body), asExpress);
  return res;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW_SECONDS * 1000);
  stubSupabaseEnv();
  createClient.mockReturnValue({
    auth: { setSession, updateUser, admin: { signOut } },
    rpc,
  });
  setSession.mockImplementation(verifiedSession);
  rpc.mockResolvedValue({ data: true, error: null });
  updateUser.mockResolvedValue({ data: {}, error: null });
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/reset - request shape', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET', validBody);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(setSession).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not an object'],
  ])('should return 400 when the body is %s', async (_label, body) => {
    const res = await callHandler('POST', body);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(setSession).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset - recovery session', () => {
  it.each([
    ['accessToken missing', { accessToken: undefined }],
    ['accessToken empty', { accessToken: '' }],
    ['accessToken blank', { accessToken: '   ' }],
    ['accessToken not a string', { accessToken: 12345 }],
    ['refreshToken missing', { refreshToken: undefined }],
    ['refreshToken empty', { refreshToken: '' }],
    ['refreshToken not a string', { refreshToken: 12345 }],
  ])(
    'should return 400 and not call Supabase when %s',
    async (_label, override) => {
      const res = await callHandler('POST', { ...validBody, ...override });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(INVALID_LINK);
      expect(setSession).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    },
  );

  it('should reject a missing session even when the password is invalid', async () => {
    const res = await callHandler('POST', { password: 'weak' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(INVALID_LINK);
  });

  it('should never change a password with only an email', async () => {
    const res = await callHandler('POST', {
      email: 'test@example.com',
      password: validBody.password,
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(setSession).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ['not a JWT', 'not-a-jwt'],
    ['a JWT with an unreadable payload', 'header.@@@.signature'],
    ['a JWT without amr', makeAccessToken(undefined)],
    ['a JWT with an amr that is not a list', makeAccessToken('otp')],
    [
      'a password login session (stolen or ordinary)',
      makeAccessToken(recoveryAmr('password')),
    ],
    [
      'a recovery session older than the limit',
      makeAccessToken(recoveryAmr('otp', NOW_SECONDS - 16 * 60)),
    ],
    ['an amr entry without a timestamp', makeAccessToken([{ method: 'otp' }])],
    ['an amr list of strings', makeAccessToken(['otp'])],
    [
      'an amr timestamp in the future',
      makeAccessToken(recoveryAmr('otp', NOW_SECONDS + 10 * 60)),
    ],
    // Without a valid exp, setSession would skip verifying the access token
    // and build the session from the refresh token alone.
    ['a token without exp', makeAccessToken(recoveryAmr(), undefined)],
    ['a token with a non-numeric exp', makeAccessToken(recoveryAmr(), 'soon')],
    ['an expired token', makeAccessToken(recoveryAmr(), NOW_SECONDS - 1)],
  ])(
    'should return 400 without calling Supabase for %s',
    async (_label, token) => {
      const res = await callHandler('POST', {
        ...validBody,
        accessToken: token,
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(INVALID_LINK);
      // An ordinary session must not even be refreshed (rotated) by setSession.
      expect(setSession).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    },
  );

  it.each(['otp', 'recovery'])(
    'should accept a recent session recorded as %s',
    async (method) => {
      const res = await callHandler('POST', {
        ...validBody,
        accessToken: makeAccessToken(recoveryAmr(method)),
      });

      expect(res.status).toHaveBeenCalledWith(200);
    },
  );

  it('should accept a session with several amr entries when one is a recent email link', async () => {
    const res = await callHandler('POST', {
      ...validBody,
      accessToken: makeAccessToken([
        { method: 'password', timestamp: NOW_SECONDS - 3600 },
        { method: 'otp', timestamp: NOW_SECONDS - 60 },
      ]),
    });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should tolerate a small clock skew on the amr timestamp', async () => {
    const res = await callHandler('POST', {
      ...validBody,
      accessToken: makeAccessToken(recoveryAmr('otp', NOW_SECONDS + 30)),
    });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should refuse a session that Supabase rebuilt from the refresh token', async () => {
    // Supabase hands back another token when it did not verify the one that
    // was sent: the claims checked before say nothing about it.
    setSession.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: {
          access_token: 'rebuilt-jwt',
          refresh_token: 'rebuilt-refresh',
          expires_in: 3600,
        },
      },
      error: null,
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(INVALID_LINK);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith('rebuilt-jwt', 'local');
  });

  it.each([
    ['expired', { status: 401, code: 'session_expired' }],
    ['forged', { status: 403, code: 'bad_jwt' }],
    ['revoked', { status: 400, code: 'refresh_token_not_found' }],
  ])(
    'should return a generic 400 when Supabase rejects the session as %s, with a valid password',
    async (_label, error) => {
      setSession.mockResolvedValue({
        data: { user: null, session: null },
        error,
      });

      const res = await callHandler('POST', validBody);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(INVALID_LINK);
      expect(updateUser).not.toHaveBeenCalled();
    },
  );
});

describe('POST /api/auth/reset - password policy', () => {
  it.each([
    ['missing', undefined],
    ['too weak', 'weak'],
    ['not a string', 12345678],
  ])(
    'should return 400 and not call Supabase when the password is %s',
    async (_label, password) => {
      const res = await callHandler('POST', { ...validBody, password });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: POLICY_MESSAGE });
      expect(setSession).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    },
  );

  it('should return 400 when Supabase rejects the password as weak', async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { status: 422, code: 'weak_password' },
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: POLICY_MESSAGE });
  });

  it('should return 400 when the new password equals the current one', async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { status: 422, code: 'same_password' },
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'The new password must be different from the current one',
    });
  });
});

describe('POST /api/auth/reset - successful reset', () => {
  it('should verify the session with Supabase and update the password', async () => {
    const res = await callHandler('POST', validBody);

    expect(setSession).toHaveBeenCalledWith({
      access_token: accessToken,
      refresh_token: 'refresh-token',
    });
    expect(updateUser).toHaveBeenCalledWith({ password: 'Valid123!' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password updated' });
  });

  it('should revoke every session of the user', async () => {
    await callHandler('POST', validBody);

    expect(signOut).toHaveBeenCalledWith(accessToken, 'global');
  });

  it('should not set any cookie: the user logs in again', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('should not return the tokens, the password or the session', async () => {
    const res = await callHandler('POST', validBody);

    const sent = JSON.stringify(res.json.mock.calls);
    expect(sent).not.toContain(accessToken);
    expect(sent).not.toContain('refresh-token');
    expect(sent).not.toContain('Valid123!');
  });

  it('should report a failed session revocation to Sentry but still succeed', async () => {
    const error = new Error('signout failed');
    signOut.mockResolvedValue({ error });

    const res = await callHandler('POST', validBody);

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { context: 'revoke-sessions-after-password-reset' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('POST /api/auth/reset - blocked user', () => {
  it('should return 403, not change the password and revoke the session', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account blocked' });
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith(accessToken, 'local');
  });

  it('should fail closed when the status check fails: no password change, session closed', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error('rpc is_active failed'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith(accessToken, 'local');
  });
});

describe('POST /api/auth/reset - recovery session after a failure', () => {
  it.each([
    ['weak_password', { status: 422, code: 'weak_password' }],
    ['same_password', { status: 422, code: 'same_password' }],
    ['a rate limit', { status: 429, code: 'over_request_rate_limit' }],
  ])(
    'should keep the session open on %s so the user can retry with the same link',
    async (_label, error) => {
      updateUser.mockResolvedValue({ data: null, error });

      await callHandler('POST', validBody);

      expect(signOut).not.toHaveBeenCalled();
    },
  );

  it('should close the session when updating the password fails unexpectedly', async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: new Error('connection refused to db.internal:5432'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith(accessToken, 'local');
    expect(signOut).not.toHaveBeenCalledWith(accessToken, 'global');
  });
});

describe('POST /api/auth/reset - rate limit', () => {
  it('should return 429 when verifying the session is rate limited', async () => {
    setSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 429, code: 'over_request_rate_limit' },
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('should return 429 when updating the password is rate limited', async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { status: 429, code: 'over_request_rate_limit' },
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Too many requests, please try again later',
    });
  });
});

describe('POST /api/auth/reset - unexpected failures', () => {
  it('should return a generic 500 when verifying the session fails unexpectedly', async () => {
    setSession.mockResolvedValue({
      data: { user: null, session: null },
      error: Object.assign(new Error('upstream down'), { status: 500 }),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
  });

  it('should return a generic 500 when Supabase returns no session', async () => {
    setSession.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('should return a generic 500 when updating the password fails unexpectedly', async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: new Error('connection refused to db.internal:5432'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should return a generic 500 when the Supabase env vars are missing', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(setSession).not.toHaveBeenCalled();
  });
});
