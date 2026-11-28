import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  PASSWORD_POLICY_MESSAGE,
  SAME_PASSWORD_MESSAGE,
} from '../../../shared/validation.js';
import {
  makeReq,
  makeRes,
  stubSignedInSupabase,
  stubSupabaseEnv,
  withErrorHandler,
} from '../../_lib/test-helpers.js';
import route from './password.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const {
  getUser,
  rpc,
  single,
  from,
  createClient,
  signInWithPassword,
  updateUser,
  signOut,
  captureException,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

// Sentry is faked to check what is reported without sending anything.
vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  captureException,
  flush: vi.fn(),
}));

const validHeaders = { authorization: 'Bearer valid-token' };
const validBody = {
  current_password: 'Current123!',
  new_password: 'Valid123!',
  confirm_password: 'Valid123!',
};
const WRONG_PASSWORD = { message: 'Current password is incorrect' };

const newSession = {
  access_token: 'new-access',
  refresh_token: 'new-refresh',
  expires_in: 3600,
  expires_at: 1790003600,
};

const handler = withErrorHandler(route);

async function callHandler(
  body: unknown = validBody,
  {
    method = 'POST',
    headers = validHeaders,
  }: { method?: string; headers?: Record<string, string> } = {},
) {
  const { res, asExpress } = makeRes();
  await handler(makeReq(method, body, headers), asExpress);
  return res;
}

function authError(code: string, status = 400) {
  return new AuthApiError('refused', status, code);
}

function failSignIn(code: string) {
  signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: authError(code),
  });
}

function failUpdate(code: string) {
  updateUser.mockResolvedValue({
    data: { user: null },
    error: authError(code),
  });
}

// No cookie may be written when the password was not changed.
function expectNoSessionCookie(res: ReturnType<typeof makeRes>['res']) {
  expect(res.setHeader).not.toHaveBeenCalledWith(
    'Set-Cookie',
    expect.anything(),
  );
}

beforeEach(() => {
  stubSupabaseEnv();
  stubSignedInSupabase({ getUser, rpc, single, from, createClient });
  createClient.mockReturnValue({
    auth: { getUser, signInWithPassword, updateUser, admin: { signOut } },
    rpc,
    from,
  });
  signInWithPassword.mockResolvedValue({
    data: { user: { id: 'user-1' }, session: newSession },
    error: null,
  });
  updateUser.mockResolvedValue({ data: {}, error: null });
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/account/password - success', () => {
  it('should answer 200 with the expiry of the new session', async () => {
    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password updated',
      expires_at: 1790003600,
    });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('should verify the password with the email of the session', async () => {
    await callHandler();

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'Current123!',
    });
  });

  it('should send the new and the current password to Supabase', async () => {
    await callHandler();

    expect(updateUser).toHaveBeenCalledWith({
      password: 'Valid123!',
      current_password: 'Current123!',
    });
  });

  it('should revoke the other sessions and keep the new one', async () => {
    await callHandler();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith('new-access', 'others');
  });

  it('should set the cookies of the new session', async () => {
    const res = await callHandler();

    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [
      expect.stringContaining('=new-access;'),
      expect.stringContaining('=new-refresh;'),
    ]);
  });

  it('should still answer 200 and report a failed revocation', async () => {
    const error = authError('unexpected_failure', 500);
    signOut.mockResolvedValue({ error });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { context: 'revoke-other-sessions-after-password-change' },
    });
  });
});

describe('POST /api/account/password - rejected requests', () => {
  it('should answer 405 to another method', async () => {
    const res = await callHandler(validBody, { method: 'PUT' });

    expect(res.status).toHaveBeenCalledWith(405);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('should answer 401 without a session', async () => {
    const res = await callHandler(validBody, { headers: {} });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('should answer 403 to a blocked account', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('should answer 415 to a body that is not JSON', async () => {
    const res = await callHandler(validBody, {
      headers: { ...validHeaders, 'content-type': 'text/plain' },
    });

    expect(res.status).toHaveBeenCalledWith(415);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('should answer 400 to an invalid input without verifying it', async () => {
    const res = await callHandler({
      ...validBody,
      confirm_password: 'Other123!',
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password confirmation does not match',
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('POST /api/account/password - current password check', () => {
  // 400 and not 401: the page would log the user out on a 401.
  it('should answer 400 to a wrong current password', async () => {
    failSignIn('invalid_credentials');

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(WRONG_PASSWORD);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expectNoSessionCookie(res);
  });

  it.each([
    ['over_request_rate_limit', 429],
    ['user_banned', 403],
    ['email_not_confirmed', 403],
    ['unexpected_failure', 500],
  ])('should answer %s with %i', async (code, status) => {
    failSignIn(code);

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(status);
    expect(updateUser).not.toHaveBeenCalled();
    expectNoSessionCookie(res);
  });

  it('should close the session and answer 500 for another user', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-2' }, session: newSession },
      error: null,
    });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith('new-access', 'local');
    expectNoSessionCookie(res);
  });
});

describe('POST /api/account/password - refused change', () => {
  it.each([
    ['weak_password', PASSWORD_POLICY_MESSAGE],
    ['same_password', SAME_PASSWORD_MESSAGE],
    ['current_password_invalid', WRONG_PASSWORD.message],
  ])(
    'should answer 400 to %s and close the new session',
    async (code, message) => {
      failUpdate(code);

      const res = await callHandler();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message });
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith('new-access', 'local');
      expectNoSessionCookie(res);
    },
  );

  it('should answer 429 to a rate limit and close the new session', async () => {
    failUpdate('over_request_rate_limit');

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(429);
    expect(signOut).toHaveBeenCalledWith('new-access', 'local');
    expectNoSessionCookie(res);
  });

  // The session is new and the password is always sent: these show a fault of
  // the code or of the Supabase settings, not something the user can fix.
  it.each([
    'current_password_required',
    'reauthentication_needed',
    'unexpected_failure',
    // Not a message of the handler, although every object has such a property.
    'constructor',
  ])('should answer 500 to %s and close the new session', async (code) => {
    failUpdate(code);

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(captureException).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith('new-access', 'local');
    expectNoSessionCookie(res);
  });

  it('should close the new session when the update throws', async () => {
    updateUser.mockRejectedValue(new Error('network down'));

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(signOut).toHaveBeenCalledWith('new-access', 'local');
    expectNoSessionCookie(res);
  });
});
