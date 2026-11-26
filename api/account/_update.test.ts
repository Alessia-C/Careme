import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  makeReq,
  makeRes,
  stubSignedInSupabase,
  stubSupabaseEnv,
  withErrorHandler,
} from '../_lib/test-helpers.js';
import route from './_update.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { getUser, rpc, single, maybeSingle, update, eq, from, createClient } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    rpc: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    from: vi.fn(),
    createClient: vi.fn(),
  }));

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const validHeaders = { authorization: 'Bearer valid-token' };
const validBody = { first_name: 'Anna', last_name: 'Rossi' };
const handler = withErrorHandler(route);

async function callHandler(
  method: string,
  body?: unknown,
  headers: Record<string, string> = validHeaders,
) {
  const { res, asExpress } = makeRes();
  await handler(makeReq(method, body, headers), asExpress);
  return res;
}

beforeEach(() => {
  stubSupabaseEnv();
  // withAuth ends its query with single(), the update with maybeSingle().
  const query = stubSignedInSupabase(
    { getUser, rpc, single, from, createClient },
    { eq, update, maybeSingle },
  );
  update.mockReturnValue(query);
  maybeSingle.mockResolvedValue({ data: validBody, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('PUT /api/account', () => {
  it('should return the saved names with the email of the session', async () => {
    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      account: { ...validBody, email: 'jane@example.com' },
    });
  });

  it('should answer with the names read back from the database', async () => {
    const saved = { first_name: 'Saved', last_name: 'Names' };
    maybeSingle.mockResolvedValue({ data: saved, error: null });

    const res = await callHandler('PUT', validBody);

    expect(res.json).toHaveBeenCalledWith({
      account: { ...saved, email: 'jane@example.com' },
    });
  });

  it('should write only the trimmed names on the profile of the caller', async () => {
    await callHandler('PUT', {
      first_name: ' Anna ',
      last_name: ' Rossi ',
    });

    expect(from).toHaveBeenLastCalledWith('profiles');
    expect(update).toHaveBeenCalledWith(validBody);
    expect(eq).toHaveBeenLastCalledWith('id', 'user-1');
  });

  it('should forbid caching the response', async () => {
    const res = await callHandler('PUT', validBody);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it.each([
    ['email', 'new@example.com'],
    ['role', 'admin'],
    ['status', 'active'],
    ['id', 'someone-else'],
  ])(
    'should return 400 and write nothing when the body has %s',
    async (field, value) => {
      const res = await callHandler('PUT', { ...validBody, [field]: value });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Only first_name and last_name can be updated',
      });
      expect(update).not.toHaveBeenCalled();
    },
  );

  // The full list of validation cases lives in _validation.test.ts.
  it.each([
    ['first_name is missing', { last_name: 'Rossi' }, 'First name'],
    ['last_name is missing', { first_name: 'Anna' }, 'Last name'],
    [
      'first_name is too long',
      { ...validBody, first_name: 'a'.repeat(51) },
      'First name',
    ],
  ])('should return 400 when %s', async (_reason, body, message) => {
    const res = await callHandler('PUT', body);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining(message),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('should return 405 for a method other than PUT', async () => {
    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(405);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('should return 401 when there is no token', async () => {
    const res = await callHandler('PUT', validBody, {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(update).not.toHaveBeenCalled();
  });

  it('should return 403 when the account is blocked', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('should return 415 when the body is not JSON', async () => {
    const res = await callHandler('PUT', validBody, {
      ...validHeaders,
      'content-type': 'text/plain',
    });

    expect(res.status).toHaveBeenCalledWith(415);
    expect(update).not.toHaveBeenCalled();
  });

  it('should return 400 when the body is not an object', async () => {
    const res = await callHandler('PUT', undefined);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('should return 404 when no row is updated', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account not found' });
  });

  it('should return 429 on a Supabase rate limit', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new AuthApiError('slow down', 429, 'over_request_rate_limit'),
    });

    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('should return the generic 500 when the update fails', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('db.internal:5432 down'),
    });

    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('db.internal');
  });
});
