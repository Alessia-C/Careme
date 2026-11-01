import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  makeReq,
  makeRes,
  stubSupabaseEnv,
  withErrorHandler,
} from '../../_lib/test-helpers.js';
import route from './list.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { getUser, rpc, single, range, from, createClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
  range: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const validHeaders = { authorization: 'Bearer valid-token' };
const listedProducts = [
  {
    id: 'product-2',
    name: 'Lip Balm',
    brand: 'Nivea',
    category: 'makeup',
    status: 'used',
    created_at: '2026-10-31T11:00:00Z',
  },
  {
    id: 'product-1',
    name: 'Hydrating Cream',
    brand: 'CeraVe',
    category: 'skincare',
    status: 'new',
    created_at: '2026-10-31T10:00:00Z',
  },
];

const handler = withErrorHandler(route);

async function callHandler(
  query: Record<string, unknown> = {},
  headers: Record<string, string> = validHeaders,
) {
  const { res, asExpress } = makeRes();
  const req = Object.assign(makeReq('GET', undefined, headers), { query });
  await handler(req, asExpress);
  return res;
}

// Every query builder method returns the same object, so the calls can be
// chained like in the real client. The terminal calls (single, range) are the
// fakes the tests configure.
function makeQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    single,
    range,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
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
  range.mockResolvedValue({
    data: listedProducts,
    count: 2,
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  single.mockReset();
});

describe('GET /api/products', () => {
  it('should return 401 when there is no token', async () => {
    const res = await callHandler({}, {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(range).not.toHaveBeenCalled();
  });

  it('should return 403 when the account is blocked', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(range).not.toHaveBeenCalled();
  });

  it('should return the products and the total', async () => {
    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      products: listedProducts,
      total: 2,
    });
  });

  it('should return an empty list with 200 when nothing matches', async () => {
    range.mockResolvedValue({ data: [], count: 0, error: null });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ products: [], total: 0 });
  });

  it('should read only the list columns of the caller, without the note', async () => {
    await callHandler();

    expect(from).toHaveBeenCalledWith('products');
    expect(query.select).toHaveBeenCalledWith(
      'id, name, brand, category, status, created_at',
      { count: 'exact' },
    );
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('should sort by newest first, with the id as tie-break', async () => {
    await callHandler();

    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', {
      ascending: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
  });

  it('should return the first 10 products by default', async () => {
    await callHandler();

    expect(range).toHaveBeenCalledWith(0, 9);
  });

  it('should apply limit and offset', async () => {
    await callHandler({ limit: '5', offset: '10' });

    expect(range).toHaveBeenCalledWith(10, 14);
  });

  it.each([
    ['zero', '0'],
    ['above the maximum', '21'],
    ['negative', '-1'],
    ['a decimal', '1.5'],
    ['text', 'abc'],
    ['empty', ''],
    ['repeated', ['5', '6']],
    ['an object', { a: '1' }],
  ])('should return 400 when the limit is %s', async (_reason, limit) => {
    const res = await callHandler({ limit });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(range).not.toHaveBeenCalled();
  });

  it.each([
    ['negative', '-1'],
    ['a decimal', '1.5'],
    ['text', 'abc'],
    ['too long', '1234567890'],
  ])('should return 400 when the offset is %s', async (_reason, offset) => {
    const res = await callHandler({ offset });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(range).not.toHaveBeenCalled();
  });

  it.each(['skincare', 'makeup'])(
    'should filter by the %s category',
    async (category) => {
      await callHandler({ category });

      expect(query.eq).toHaveBeenCalledWith('category', category);
    },
  );

  it.each([
    ['all', 'all'],
    ['missing', undefined],
  ])('should not filter when the category is %s', async (_reason, category) => {
    await callHandler({ category });

    expect(query.eq).not.toHaveBeenCalledWith('category', expect.anything());
  });

  it.each([
    ['unknown', 'perfume'],
    ['a different case', 'Skincare'],
    ['empty', ''],
    ['repeated', ['skincare', 'makeup']],
  ])('should return 400 when the category is %s', async (_reason, category) => {
    const res = await callHandler({ category });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(range).not.toHaveBeenCalled();
  });

  it('should search the name ignoring the case and the brand respecting it', async () => {
    await callHandler({ search: 'CeraVe' });

    expect(query.or).toHaveBeenCalledWith(
      'name.ilike."*CeraVe*",brand.like."*CeraVe*"',
    );
  });

  it('should trim the search', async () => {
    await callHandler({ search: '  cream ' });

    expect(query.or).toHaveBeenCalledWith(
      'name.ilike."*cream*",brand.like."*cream*"',
    );
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['missing', undefined],
  ])('should not search when the search is %s', async (_reason, search) => {
    await callHandler({ search });

    expect(query.or).not.toHaveBeenCalled();
  });

  it.each([
    ['a percent', '50%'],
    ['an underscore', 'a_b'],
    ['a backslash', 'a\\b'],
    ['an asterisk', 'a*b'],
    ['a double quote', 'a"b'],
    ['a comma', 'a,b'],
    ['a parenthesis', 'a(b)'],
    ['a NUL character', 'a\u0000b'],
    ['a filter injection', 'a",user_id.neq.x'],
    ['more than 100 characters', 'a'.repeat(101)],
    ['repeated', ['a', 'b']],
    ['an object', { a: 'b' }],
  ])('should return 400 when the search has %s', async (_reason, search) => {
    const res = await callHandler({ search });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(range).not.toHaveBeenCalled();
  });

  it('should return 429 when Supabase rate limits the request', async () => {
    range.mockResolvedValue({
      data: null,
      count: null,
      error: new AuthApiError('rate limit', 429, 'over_request_rate_limit'),
    });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('should return 500 when the query fails', async () => {
    range.mockResolvedValue({
      data: null,
      count: null,
      error: new Error('database down'),
    });

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
