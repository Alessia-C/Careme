import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReq, makeRes, stubSupabaseEnv } from '../_lib/test-helpers.js';
import handler from './login.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const {
  signInWithPassword,
  signOut,
  rpc,
  single,
  from,
  createClient,
  captureException,
} = vi.hoisted(() => ({
  signOut: vi.fn(),
  captureException: vi.fn(),
  signInWithPassword: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

// Sentry is faked to check what is reported without sending anything.
vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  captureException,
  flush: vi.fn(),
}));

const validBody = { email: 'test@example.com', password: 'Valid123!' };

const session = {
  access_token: 'access-jwt',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1790000000,
};

const signedIn = {
  data: {
    user: { id: 'user-1', email: 'test@example.com', app_metadata: {} },
    session,
  },
  error: null,
};

async function callHandler(method: string, body: unknown) {
  const { res, asVercel } = makeRes();
  await handler(makeReq(method, body), asVercel);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  // from('profiles').select('role').eq('id', ...).single() chain.
  const query = { select: vi.fn(), eq: vi.fn(), single };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  from.mockReturnValue(query);
  createClient.mockReturnValue({
    auth: { signInWithPassword, admin: { signOut } },
    rpc,
    from,
  });
  signOut.mockResolvedValue({ error: null });
  signInWithPassword.mockResolvedValue(signedIn);
  rpc.mockResolvedValue({ data: true, error: null });
  single.mockResolvedValue({ data: { role: 'user' }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/login - request shape', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET', validBody);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not an object'],
  ])('should return 400 when the body is %s', async (_label, body) => {
    const res = await callHandler('POST', body);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login - validation', () => {
  it.each([
    ['email missing', { ...validBody, email: undefined }, 'required'],
    ['email not a string', { ...validBody, email: 123 }, 'required'],
    ['password missing', { ...validBody, password: undefined }, 'required'],
    ['password not a string', { ...validBody, password: 12345678 }, 'required'],
    ['email malformed', { ...validBody, email: 'no-at-sign' }, 'Invalid email'],
  ])(
    'should return 400 and not call Supabase when %s',
    async (_label, body, expectedMessage) => {
      const res = await callHandler('POST', body);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining(expectedMessage),
      });
      expect(signInWithPassword).not.toHaveBeenCalled();
    },
  );
});

describe('POST /api/auth/login - successful login', () => {
  it('should return 200 with a reduced user and no tokens in the body', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Login successful',
      user: { id: 'user-1', email: 'test@example.com', role: 'user' },
      expires_at: 1790000000,
    });
  });

  it('should return the session expiry so the page can renew in time', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ expires_at: 1790000000 }),
    );
  });

  it('should set both tokens in HttpOnly SameSite=Strict cookies', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.setHeader).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [
      expect.stringMatching(
        /^__Host-sb-access-token=access-jwt; HttpOnly; SameSite=Strict; Path=\/; Max-Age=3600/,
      ),
      expect.stringMatching(
        /^__Secure-sb-refresh-token=refresh-token; HttpOnly; SameSite=Strict; Path=\/api\/auth; Secure$/,
      ),
    ]);
  });

  it('should never expose the refresh token outside the cookie', async () => {
    const res = await callHandler('POST', validBody);

    expect(JSON.stringify(res.json.mock.calls)).not.toContain('refresh-token');
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('access-jwt');
  });

  it('should return the admin role for an admin profile', async () => {
    single.mockResolvedValue({ data: { role: 'admin' }, error: null });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ role: 'admin' }),
      }),
    );
  });

  it('should read only the role of the logged-in user', async () => {
    await callHandler('POST', validBody);

    expect(from).toHaveBeenCalledWith('profiles');
    expect(from().select).toHaveBeenCalledWith('role');
    expect(from().eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('should normalize the email before calling Supabase', async () => {
    await callHandler('POST', { ...validBody, email: '  Test@Example.COM ' });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: validBody.password,
    });
  });

  it('should check the profile status with the caller JWT', async () => {
    await callHandler('POST', validBody);

    // Second client: the one built with the user's token so RLS applies.
    expect(createClient).toHaveBeenLastCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer access-jwt' } },
      }),
    );
    expect(rpc).toHaveBeenCalledWith('is_active');
  });
});

describe('POST /api/auth/login - blocked account', () => {
  it('should return 403 and no tokens when the profile is not active', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account blocked' });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('access-jwt');
  });

  it('should revoke the session Supabase just created for a blocked user', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await callHandler('POST', validBody);

    expect(signOut).toHaveBeenCalledWith('access-jwt', 'local');
  });

  it('should still return 403 and report to Sentry when the revoke fails', async () => {
    const failure = new Error('revoke failed');
    rpc.mockResolvedValue({ data: false, error: null });
    signOut.mockResolvedValue({ error: failure });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(captureException).toHaveBeenCalledWith(failure, expect.anything());
  });

  it('should not revoke anything for an active account', async () => {
    await callHandler('POST', validBody);

    expect(signOut).not.toHaveBeenCalled();
  });

  it('should treat a null status as blocked', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it.each(['user_banned', 'email_not_confirmed'])(
    'should return 403 when Supabase reports %s',
    async (code) => {
      signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { code },
      });

      const res = await callHandler('POST', validBody);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
});

describe('POST /api/auth/login - failed credentials', () => {
  it('should return a generic 400 for invalid credentials', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials' },
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid email or password',
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it.each(['over_request_rate_limit', 'over_email_send_rate_limit'])(
    'should return 429 when Supabase reports %s',
    async (code) => {
      signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { code },
      });

      const res = await callHandler('POST', validBody);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Too many requests, please try again later',
      });
    },
  );
});

describe('POST /api/auth/login - unexpected failures', () => {
  it('should return a generic 500 when Supabase fails unexpectedly', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('connection refused to db.internal:5432'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
  });

  it('should return a generic 500 and no tokens when the status check fails', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('access-jwt');
  });

  it('should return a generic 500 and no tokens when the role read fails', async () => {
    single.mockResolvedValue({ data: null, error: new Error('read failed') });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('access-jwt');
  });

  it.each([
    ['unknown', { role: 'operator' }],
    ['missing', {}],
    ['no profile', null],
  ])(
    'should return a generic 500 and no tokens when the role is %s',
    async (_label, profile) => {
      single.mockResolvedValue({ data: profile, error: null });

      const res = await callHandler('POST', validBody);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify(res.json.mock.calls)).not.toContain('access-jwt');
    },
  );

  it('should return a generic 500 when the Supabase env vars are missing', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
