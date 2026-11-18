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
const { verifyOtp, updateUser, signOut, rpc, createClient, captureException } =
  vi.hoisted(() => ({
    verifyOtp: vi.fn(),
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

const validBody = { token: 'hashed-token', password: 'Valid123!' };

const recovered = {
  data: {
    user: { id: 'user-1', email: 'test@example.com' },
    session: {
      access_token: 'recovery-jwt',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    },
  },
  error: null,
};

const POLICY_MESSAGE = expect.stringContaining('Invalid password');
const INVALID_LINK = { message: 'Invalid or expired link' };

const handler = withErrorHandler(route);

async function callHandler(method: string, body: unknown) {
  const { res, asExpress } = makeRes();
  await handler(makeReq(method, body), asExpress);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  createClient.mockReturnValue({
    auth: { verifyOtp, updateUser, admin: { signOut } },
    rpc,
  });
  verifyOtp.mockResolvedValue(recovered);
  rpc.mockResolvedValue({ data: true, error: null });
  updateUser.mockResolvedValue({ data: {}, error: null });
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/reset - request shape', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET', validBody);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not an object'],
  ])('should return 400 when the body is %s', async (_label, body) => {
    const res = await callHandler('POST', body);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset - token', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['not a string', 12345],
  ])(
    'should return 400 and not call Supabase when the token is %s',
    async (_label, token) => {
      const res = await callHandler('POST', { ...validBody, token });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(INVALID_LINK);
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    },
  );

  it('should reject a missing token even when the password is invalid', async () => {
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
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', { status: 403, code: 'otp_expired' }],
    ['unknown', { status: 400, code: 'validation_failed' }],
  ])(
    'should return a generic 400 when the token is %s, with a valid password',
    async (_label, error) => {
      verifyOtp.mockResolvedValue({
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
    'should return 400 and keep the token unused when the password is %s',
    async (_label, password) => {
      const res = await callHandler('POST', { ...validBody, password });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: POLICY_MESSAGE });
      // verifyOtp consumes the token: a weak password must not burn the link.
      expect(verifyOtp).not.toHaveBeenCalled();
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
  it('should verify the token as a recovery token and update the password', async () => {
    const res = await callHandler('POST', validBody);

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hashed-token',
      type: 'recovery',
    });
    expect(updateUser).toHaveBeenCalledWith({ password: 'Valid123!' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password updated' });
  });

  it('should revoke every session of the user', async () => {
    await callHandler('POST', validBody);

    expect(signOut).toHaveBeenCalledWith('recovery-jwt', 'global');
  });

  it('should not set any cookie: the user logs in again', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('should not return the token, the password or the session', async () => {
    const res = await callHandler('POST', validBody);

    const sent = JSON.stringify(res.json.mock.calls);
    expect(sent).not.toContain('hashed-token');
    expect(sent).not.toContain('Valid123!');
    expect(sent).not.toContain('recovery-jwt');
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
    expect(signOut).toHaveBeenCalledWith('recovery-jwt', 'local');
  });
});

describe('POST /api/auth/reset - blocked check failure', () => {
  it('should fail closed when the status check fails: no password change', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error('rpc is_active failed'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalledWith('recovery-jwt', 'global');
  });
});

describe('POST /api/auth/reset - rate limit', () => {
  it('should return 429 when verifying the token is rate limited', async () => {
    verifyOtp.mockResolvedValue({
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
  it('should return a generic 500 when verifying the token fails unexpectedly', async () => {
    verifyOtp.mockResolvedValue({
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
    verifyOtp.mockResolvedValue({
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
    expect(signOut).not.toHaveBeenCalled();
  });

  it('should return a generic 500 when the Supabase env vars are missing', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
