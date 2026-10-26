import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { makeReq, makeRes, stubSupabaseEnv } from '../_lib/test-helpers.js';
import { getSessionCookieName } from '../_lib/auth.js';
import handler from './me.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { getUser, rpc, single, from, createClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
}));

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
  const query = { select: vi.fn(), eq: vi.fn(), single };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  from.mockReturnValue(query);
  createClient.mockReturnValue({ auth: { getUser }, rpc, from });
  getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'jane@example.com' } },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
  single.mockResolvedValue({ data: { role: 'user' }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('GET /api/auth/me', () => {
  it('should return 405 for a method other than GET', async () => {
    const res = await callHandler('POST', validHeaders);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('should return 401 when there is no token', async () => {
    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('should return the user with the role read from the database', async () => {
    single.mockResolvedValue({ data: { role: 'admin' }, error: null });

    const res = await callHandler('GET', validHeaders);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'user-1', email: 'jane@example.com', role: 'admin' },
    });
  });

  it('should accept the session cookie sent by the browser', async () => {
    const res = await callHandler(
      'GET',
      {},
      { [getSessionCookieName()]: 'cookie-jwt' },
    );

    expect(getUser).toHaveBeenCalledWith('cookie-jwt');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should not put any token in the response', async () => {
    const res = await callHandler('GET', validHeaders);

    expect(JSON.stringify(res.json.mock.calls)).not.toContain('valid-token');
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('should return 401 when the token is expired or revoked', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('jwt expired', 401, 'bad_jwt'),
    });

    const res = await callHandler('GET', validHeaders);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 403 when the account is blocked', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler('GET', validHeaders);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account blocked' });
  });
});
