import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeReq,
  makeRes,
  stubSupabaseEnv,
  withErrorHandler,
} from '../../_lib/test-helpers.js';
import route from './recover.js';

// vi.mock is hoisted above the imports, so the fake must be created with
// vi.hoisted to already exist when the mock factory runs.
const { resetPasswordForEmail } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail } }),
}));

const validBody = { email: 'test@example.com' };
const GENERIC_RESPONSE = {
  message:
    'If the email is registered, you will receive a link to reset your password',
};

const handler = withErrorHandler(route);

async function callHandler(method: string, body: unknown) {
  const { res, asExpress } = makeRes();
  await handler(makeReq(method, body), asExpress);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  vi.stubEnv('APP_URL', 'https://careme.example.com');
  resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/recover - request shape', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET', validBody);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not an object'],
  ])('should return 400 when the body is %s', async (_label, body) => {
    const res = await callHandler('POST', body);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/recover - validation', () => {
  it.each([
    ['missing', undefined],
    ['malformed', 'no-at-sign'],
    ['blank', '   '],
    ['not a string', 123],
  ])(
    'should return 400 and not call Supabase when the email is %s',
    async (_label, email) => {
      const res = await callHandler('POST', { email });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email' });
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    },
  );
});

describe('POST /api/auth/recover - successful request', () => {
  it('should return the generic 200 for a valid email', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(GENERIC_RESPONSE);
  });

  it('should normalize the email and send the link to the app reset page', async () => {
    await callHandler('POST', { email: '  Test@Example.COM ' });

    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      redirectTo: 'https://careme.example.com/reset-password',
    });
  });

  it('should ignore a redirectTo sent by the caller', async () => {
    // A caller-controlled address would send the reset token to another site.
    await callHandler('POST', {
      ...validBody,
      redirectTo: 'https://evil.example.org/steal',
    });

    const [, options] = resetPasswordForEmail.mock.calls[0];
    expect(options).toEqual({
      redirectTo: 'https://careme.example.com/reset-password',
    });
  });

  it('should answer the same for an email that is not registered', async () => {
    // Supabase reports success for an unknown email as well: the handler must
    // not add any difference of its own.
    const registered = await callHandler('POST', validBody);
    const unknown = await callHandler('POST', {
      email: 'nobody@example.com',
    });

    expect(unknown.status).toHaveBeenCalledWith(200);
    expect(unknown.json.mock.calls).toEqual(registered.json.mock.calls);
  });
});

describe('POST /api/auth/recover - rate limit', () => {
  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
    'should return 429 when Supabase reports %s',
    async (code) => {
      resetPasswordForEmail.mockResolvedValue({ data: null, error: { code } });

      const res = await callHandler('POST', validBody);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Too many requests, please try again later',
      });
    },
  );
});

describe('POST /api/auth/recover - unexpected failures', () => {
  it('should return a generic 500 when Supabase fails unexpectedly', async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new Error('connection refused to db.internal:5432'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
  });

  it('should return a generic 500 when APP_URL is missing', async () => {
    vi.stubEnv('APP_URL', '');

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('should return a generic 500 when the Supabase env vars are missing', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
