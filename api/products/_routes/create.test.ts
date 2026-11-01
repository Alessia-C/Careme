import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  makeReq,
  makeRes,
  stubSupabaseEnv,
  withErrorHandler,
} from '../../_lib/test-helpers.js';
import route from './create.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { getUser, rpc, single, maybeSingle, insert, from, createClient } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    rpc: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    from: vi.fn(),
    createClient: vi.fn(),
  }));

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const validHeaders = { authorization: 'Bearer valid-token' };
const validBody = {
  name: 'Hydrating Cream',
  brand: 'CeraVe',
  category: 'skincare',
  status: 'new',
  note: 'Bought in May',
};
const createdProduct = {
  id: 'product-1',
  name: 'Hydrating Cream',
  brand: 'CeraVe',
  category: 'skincare',
  status: 'new',
  note: 'Bought in May',
  created_at: '2026-10-31T10:00:00Z',
};

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

// Every query builder method returns the same object, so the calls can be
// chained like in the real client. The terminal calls (single, maybeSingle)
// are the fakes the tests configure.
function makeQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    insert,
    single,
    maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  insert.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  stubSupabaseEnv();
  from.mockImplementation(() => makeQuery());
  createClient.mockReturnValue({ auth: { getUser }, rpc, from });
  getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'jane@example.com' } },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
  // withAuth reads the role with single(); the insert reads the new row with
  // it too, so the first call is the role and the next one the product.
  single
    .mockResolvedValueOnce({ data: { role: 'user' }, error: null })
    .mockResolvedValue({ data: createdProduct, error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  single.mockReset();
});

describe('POST /api/products', () => {
  it('should return 405 for a method other than POST', async () => {
    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(405);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('should return 401 when there is no token', async () => {
    const res = await callHandler('POST', validBody, {
      'content-type': 'application/json',
    });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should return 403 when the account is blocked', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should return 415 when the body is not JSON', async () => {
    const res = await callHandler('POST', validBody, {
      ...validHeaders,
      'content-type': 'text/plain',
    });

    expect(res.status).toHaveBeenCalledWith(415);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should return 400 when the body is not an object', async () => {
    const res = await callHandler('POST', undefined);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should create the product and return 201 without a duplicate', async () => {
    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      product: createdProduct,
      duplicate: false,
      duplicateOf: null,
    });
  });

  it('should take user_id from the token and ignore id, user_id and created_at in the body', async () => {
    await callHandler('POST', {
      ...validBody,
      id: 'forged-id',
      user_id: 'someone-else',
      created_at: '2000-01-01T00:00:00Z',
    });

    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'Hydrating Cream',
      brand: 'CeraVe',
      category: 'skincare',
      status: 'new',
      note: 'Bought in May',
    });
  });

  it('should trim name, brand and note before saving them', async () => {
    await callHandler('POST', {
      ...validBody,
      name: '  Hydrating Cream ',
      brand: ' CeraVe  ',
      note: '  Bought in May ',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hydrating Cream',
        brand: 'CeraVe',
        note: 'Bought in May',
      }),
    );
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['blank', '   '],
  ])('should save a %s note as null', async (_reason, note) => {
    await callHandler('POST', { ...validBody, note });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ note: null }),
    );
  });

  it('should flag a duplicate and return its id, creating the product anyway', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 'product-0' }, error: null });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      product: createdProduct,
      duplicate: true,
      duplicateOf: 'product-0',
    });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('should look for the duplicate only among the caller products, by exact name and brand', async () => {
    await callHandler('POST', { ...validBody, name: ' Hydrating Cream ' });

    const query = from.mock.results[from.mock.results.length - 2].value;
    expect(from).toHaveBeenCalledWith('products');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('name', 'Hydrating Cream');
    expect(query.eq).toHaveBeenCalledWith('brand', 'CeraVe');
  });

  it.each([
    ['name is missing', { name: undefined }, 'Name is required'],
    ['name is blank', { name: '   ' }, 'Name is required'],
    ['name is not a string', { name: 42 }, 'Name is required'],
    ['name is too long', { name: 'a'.repeat(101) }, 'Name is required'],
    ['brand is missing', { brand: undefined }, 'Brand is required'],
    ['brand is blank', { brand: '' }, 'Brand is required'],
    ['brand is too long', { brand: 'a'.repeat(101) }, 'Brand is required'],
    ['category is missing', { category: undefined }, 'Category must be'],
    ['category is unknown', { category: 'perfume' }, 'Category must be'],
    ['status is missing', { status: undefined }, 'Status must be'],
    ['status is unknown', { status: 'open' }, 'Status must be'],
    ['note is not a string', { note: 5 }, 'Note must be a string'],
    ['note is too long', { note: 'a'.repeat(501) }, 'Note is too long'],
    ['name has a NUL character', { name: 'a\u0000b' }, 'Name is required'],
    ['brand has a NUL character', { brand: 'a\u0000b' }, 'Brand is required'],
    ['note has a NUL character', { note: 'a\u0000b' }, 'Note contains'],
  ])('should return 400 when %s', async (_reason, override, message) => {
    const res = await callHandler('POST', { ...validBody, ...override });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining(message),
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('should accept values exactly at the length limits', async () => {
    const res = await callHandler('POST', {
      ...validBody,
      name: 'a'.repeat(100),
      brand: 'b'.repeat(100),
      note: 'c'.repeat(500),
    });

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should return 429 on a Supabase rate limit', async () => {
    single.mockReset();
    single
      .mockResolvedValueOnce({ data: { role: 'user' }, error: null })
      .mockResolvedValue({
        data: null,
        error: new AuthApiError('slow down', 429, 'over_request_rate_limit'),
      });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('should return the generic 500 when the duplicate lookup fails', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('db.internal:5432 down'),
    });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('db.internal');
    expect(insert).not.toHaveBeenCalled();
  });

  it('should return the generic 500 when the insert fails (e.g. RLS refuses it)', async () => {
    single.mockReset();
    single
      .mockResolvedValueOnce({ data: { role: 'user' }, error: null })
      .mockResolvedValue({
        data: null,
        error: new Error('new row violates row-level security policy'),
      });

    const res = await callHandler('POST', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('row-level');
  });
});
