import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  makeReq,
  makeRes,
  stubSupabaseEnv,
  withErrorHandler,
} from '../../_lib/test-helpers.js';
import route from './remove.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { getUser, rpc, single, maybeSingle, from, createClient } = vi.hoisted(
  () => ({
    getUser: vi.fn(),
    rpc: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    from: vi.fn(),
    createClient: vi.fn(),
  }),
);

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const validHeaders = { authorization: 'Bearer valid-token' };
const productId = '123e4567-e89b-42d3-a456-426614174000';

const handler = withErrorHandler(route);

async function callHandler(
  method = 'DELETE',
  id: unknown = productId,
  headers: Record<string, string> = validHeaders,
) {
  const { res, asExpress } = makeRes();
  const req = Object.assign(makeReq(method, undefined, headers), {
    params: { id },
  });
  await handler(req, asExpress);
  return res;
}

// Every query builder method returns the same object, so the calls can be
// chained like in the real client. The terminal calls (single, maybeSingle)
// are the fakes the tests configure.
function makeQuery() {
  const query = {
    select: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    single,
    maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

let query: ReturnType<typeof makeQuery>;

beforeEach(() => {
  stubSupabaseEnv();
  query = makeQuery();
  from.mockImplementation(() => query);
  createClient.mockReturnValue({ auth: { getUser }, rpc, from });
  getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'jane@example.com' } },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
  // withAuth reads the role with single().
  single.mockResolvedValue({ data: { role: 'user' }, error: null });
  // The deleted row, returned by select('id').
  maybeSingle.mockResolvedValue({ data: { id: productId }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  single.mockReset();
});

describe('DELETE /api/products/:id', () => {
  it('should return 405 for a method other than DELETE', async () => {
    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(405);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('should return 401 when there is no token', async () => {
    const res = await callHandler('DELETE', productId, {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(query.delete).not.toHaveBeenCalled();
  });

  it('should return 403 when the account is blocked', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(query.delete).not.toHaveBeenCalled();
  });

  it('should return 204 when the product is deleted', async () => {
    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('should delete the id among the products of the caller', async () => {
    await callHandler();

    expect(from).toHaveBeenCalledWith('products');
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('id', productId);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.select).toHaveBeenCalledWith('id');
  });

  it('should return 404 when the product does not exist or belongs to someone else', async () => {
    // RLS and the user_id filter both hide the row of another user, so no
    // row is deleted, as for a missing id.
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' });
  });

  it.each([
    ['not a uuid', 'abc'],
    ['empty', ''],
    ['a uuid with extra characters', `${productId}x`],
    ['not a string', ['a', 'b']],
  ])(
    'should return 404 without querying when the id is %s',
    async (_reason, id) => {
      const res = await callHandler('DELETE', id);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(query.delete).not.toHaveBeenCalled();
    },
  );

  it('should return 429 when Supabase rate limits the request', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new AuthApiError('slow down', 429, 'over_request_rate_limit'),
    });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('should return 500 when the query fails', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('db.internal:5432 down'),
    });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('db.internal');
  });
});
