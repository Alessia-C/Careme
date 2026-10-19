import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReq, makeRes, stubSupabaseEnv } from '../_lib/test-helpers.js';
import handler from './signup.js';

// vi.mock is hoisted above the imports, so the fake must be created with
// vi.hoisted to already exist when the mock factory runs.
const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signUp } }),
}));

const validBody = {
  email: 'test@example.com',
  password: 'Valid123!',
  firstName: 'Test',
  lastName: 'User',
};

async function callHandler(method: string, body: unknown) {
  const { res, asVercel } = makeRes();
  await handler(makeReq(method, body), asVercel);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  signUp.mockResolvedValue({
    data: { user: { identities: [{ id: '1' }] } },
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/signup - request shape', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET', validBody);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(signUp).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not an object'],
  ])('should return 400 when the body is %s', async (_label, body) => {
    const res = await callHandler('POST', body);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/signup - validation', () => {
  it.each([
    ['firstName missing', { ...validBody, firstName: undefined }, 'First name'],
    ['firstName blank', { ...validBody, firstName: '   ' }, 'First name'],
    ['firstName not a string', { ...validBody, firstName: 42 }, 'First name'],
    ['lastName missing', { ...validBody, lastName: undefined }, 'Last name'],
    ['lastName blank', { ...validBody, lastName: '' }, 'Last name'],
    ['email missing', { ...validBody, email: undefined }, 'Invalid email'],
    ['email malformed', { ...validBody, email: 'no-at-sign' }, 'Invalid email'],
    ['email not a string', { ...validBody, email: 123 }, 'Invalid email'],
    ['password missing', { ...validBody, password: undefined }, 'password'],
    ['password too weak', { ...validBody, password: 'weak' }, 'password'],
    ['password not a string', { ...validBody, password: 12345678 }, 'password'],
  ])(
    'should return 400 and not call Supabase when %s',
    async (_label, body, expectedMessage) => {
      const res = await callHandler('POST', body);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining(expectedMessage),
      });
      expect(signUp).not.toHaveBeenCalled();
    },
  );
});

describe('POST /api/auth/signup - successful signup', () => {
  it('should return 201 for a valid request', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Signup successful' });
  });

  it('should normalize the email and trim the names', async () => {
    await callHandler('POST', {
      ...validBody,
      email: '  Test@Example.COM ',
      firstName: ' Test ',
      lastName: ' User ',
    });

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: validBody.password,
      options: { data: { first_name: 'Test', last_name: 'User' } },
    });
  });

  it('should send only first_name and last_name as metadata', async () => {
    // role and status are user-controlled if forwarded: they must never reach
    // Supabase, the database defaults decide them.
    await callHandler('POST', {
      ...validBody,
      role: 'admin',
      status: 'active',
    });

    const [{ options }] = signUp.mock.calls[0];
    expect(Object.keys(options.data)).toEqual(['first_name', 'last_name']);
  });
});

describe('POST /api/auth/signup - duplicate email', () => {
  it('should return a generic 400 when Supabase reports an existing user', async () => {
    signUp.mockResolvedValue({
      data: { user: null },
      error: { code: 'user_already_exists' },
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to complete signup',
    });
  });

  it('should return the same generic 400 when the user has no identities', async () => {
    // Supabase hides duplicates behind a fake success when email confirmation
    // is on.
    signUp.mockResolvedValue({
      data: { user: { identities: [] } },
      error: null,
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to complete signup',
    });
  });
});

describe('POST /api/auth/signup - rate limit', () => {
  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
    'should return 429 when Supabase reports %s',
    async (code) => {
      signUp.mockResolvedValue({
        data: { user: null },
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

describe('POST /api/auth/signup - unexpected failures', () => {
  it('should return a generic 500 when Supabase fails unexpectedly', async () => {
    signUp.mockResolvedValue({
      data: { user: null },
      error: new Error('connection refused to db.internal:5432'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
  });

  it('should return a generic 500 when the Supabase env vars are missing', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(signUp).not.toHaveBeenCalled();
  });
});
