import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeReq,
  makeRes,
  stubSignedInSupabase,
  stubSupabaseEnv,
  withErrorHandler,
} from '../_lib/test-helpers.js';
import route from './_get.js';

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
const handler = withErrorHandler(route);

async function callHandler(
  method: string,
  headers: Record<string, string> = validHeaders,
) {
  const { res, asExpress } = makeRes();
  await handler(makeReq(method, undefined, headers), asExpress);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  stubSignedInSupabase({ getUser, rpc, single, from, createClient });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('GET /api/account', () => {
  it('should return the names and the email of the caller, and nothing else', async () => {
    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      account: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      },
    });
  });

  it('should return empty strings for missing names', async () => {
    single.mockResolvedValue({
      data: { role: 'user', first_name: null, last_name: null },
      error: null,
    });

    const res = await callHandler('GET');

    expect(res.json).toHaveBeenCalledWith({
      account: { first_name: '', last_name: '', email: 'jane@example.com' },
    });
  });

  it('should forbid caching the response', async () => {
    const res = await callHandler('GET');

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('should return 405 for a method other than GET', async () => {
    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(405);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('should return 401 when there is no token', async () => {
    const res = await callHandler('GET', {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('should return 403 when the account is blocked', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account blocked' });
  });
});
