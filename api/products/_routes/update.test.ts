import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  makeReq,
  makeRes,
  stubSupabaseEnv,
  withErrorHandler,
} from '../../_lib/test-helpers.js';
import route from './update.js';

// vi.mock is hoisted above the imports, so the fakes must be created with
// vi.hoisted to already exist when the mock factory runs.
const { getUser, rpc, single, maybeSingle, update, from, createClient } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    rpc: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    from: vi.fn(),
    createClient: vi.fn(),
  }));

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

const productId = '123e4567-e89b-42d3-a456-426614174000';
const validHeaders = { authorization: 'Bearer valid-token' };
const validBody = {
  name: 'Hydrating Cream',
  brand: 'CeraVe',
  category: 'skincare',
  status: 'used',
  note: 'Bought in May',
};
const updatedProduct = {
  id: productId,
  ...validBody,
  created_at: '2026-10-31T10:00:00Z',
};

const handler = withErrorHandler(route);

async function callHandler(
  method: string,
  body?: unknown,
  headers: Record<string, string> = validHeaders,
  id: string = productId,
) {
  const { res, asExpress } = makeRes();
  const req = makeReq(method, body, headers);
  req.params = { id };
  await handler(req, asExpress);
  return res;
}

// Every query builder method returns the same object, so the calls can be
// chained like in the real client. The terminal calls (single, maybeSingle)
// are the fakes the tests configure.
function makeQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    update,
    single,
    maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  update.mockReturnValue(query);
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
  // withAuth reads the role with single(); the update reads the row with
  // maybeSingle().
  single.mockResolvedValue({ data: { role: 'user' }, error: null });
  maybeSingle.mockResolvedValue({ data: updatedProduct, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  single.mockReset();
});

describe('PUT /api/products/:id', () => {
  it('should return 405 for a method other than PUT', async () => {
    const res = await callHandler('GET');

    expect(res.status).toHaveBeenCalledWith(405);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('should return 401 when there is no token', async () => {
    const res = await callHandler('PUT', validBody, {
      'content-type': 'application/json',
    });

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

  it('should update the product and return it with 200', async () => {
    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ product: updatedProduct });
  });

  it('should only change the product of the caller, found by id', async () => {
    await callHandler('PUT', validBody);

    const query = from.mock.results[from.mock.results.length - 1].value;
    expect(from).toHaveBeenCalledWith('products');
    expect(query.eq).toHaveBeenCalledWith('id', productId);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('should write only the whitelisted fields and ignore id, user_id and created_at in the body', async () => {
    await callHandler('PUT', {
      ...validBody,
      id: 'forged-id',
      user_id: 'someone-else',
      created_at: '2000-01-01T00:00:00Z',
    });

    expect(update).toHaveBeenCalledWith({
      name: 'Hydrating Cream',
      brand: 'CeraVe',
      category: 'skincare',
      status: 'used',
      note: 'Bought in May',
    });
  });

  it('should trim name, brand and note before saving them', async () => {
    await callHandler('PUT', {
      ...validBody,
      name: '  Hydrating Cream ',
      brand: ' CeraVe  ',
      note: '  Bought in May ',
    });

    expect(update).toHaveBeenCalledWith(
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
  ])('should clear the note when it is %s', async (_reason, note) => {
    await callHandler('PUT', { ...validBody, note });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ note: null }),
    );
  });

  // The full list of validation cases lives in _validation.test.ts: here only
  // the ones the endpoint must answer with a 400 without touching the database.
  it.each([
    ['name is missing', { name: undefined }, 'Name is required'],
    ['brand is empty', { brand: '' }, 'Brand is required'],
    ['brand is blank', { brand: '   ' }, 'Brand is required'],
    ['category is unknown', { category: 'perfume' }, 'Category must be'],
    ['status is unknown', { status: 'open' }, 'Status must be'],
  ])('should return 400 when %s', async (_reason, override, message) => {
    const res = await callHandler('PUT', { ...validBody, ...override });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining(message),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('should return 404 without calling the database when the id is not a uuid', async () => {
    const res = await callHandler('PUT', validBody, validHeaders, 'abc');

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' });
    expect(update).not.toHaveBeenCalled();
  });

  it('should answer 404 about the id before 400 about the body', async () => {
    const res = await callHandler('PUT', {}, validHeaders, 'abc');

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 404 when no row is updated (missing or of another user)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' });
  });

  it('should return 429 on a Supabase rate limit', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new AuthApiError('slow down', 429, 'over_request_rate_limit'),
    });

    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('should return the generic 500 when the update fails (e.g. RLS refuses it)', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('db.internal:5432 down'),
    });

    const res = await callHandler('PUT', validBody);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('db.internal');
  });
});
