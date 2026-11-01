// @vitest-environment node
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { stubSupabaseEnv } from '../_lib/test-helpers.js';
import app from './_app.js';

// These tests go through a real HTTP server, so they check the wiring that the
// route tests (which call the handlers directly) cannot see: routing, the body
// parser, the 404 and the order of the middleware.
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

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  // address() is string | AddressInfo | null; after listen(0) on TCP it is
  // always an AddressInfo.
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const createdProduct = { id: 'product-1', name: 'Cream', brand: 'CeraVe' };

beforeEach(() => {
  stubSupabaseEnv();
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
  from.mockReturnValue(query);
  createClient.mockReturnValue({ auth: { getUser }, rpc, from });
  getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@example.com' } },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
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

const validBody = JSON.stringify({
  name: 'Cream',
  brand: 'CeraVe',
  category: 'skincare',
  status: 'new',
});

function post(
  path: string,
  body: string,
  headers: Record<string, string> = {},
) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer valid-token',
      ...headers,
    },
    body,
  });
}

describe('products app - routing', () => {
  it('should create a product on POST /api/products', async () => {
    const res = await post('/api/products', validBody);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      product: createdProduct,
      duplicate: false,
      duplicateOf: null,
    });
  });

  it('should answer 404 with a JSON body for an unknown path', async () => {
    const res = await fetch(`${baseUrl}/api/products/unknown/path`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Not found' });
  });

  it('should treat the path as case sensitive', async () => {
    const res = await post('/api/Products', validBody);

    expect(res.status).toBe(404);
  });

  it.each(['GET', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'])(
    'should answer 405 to %s on the POST-only route',
    async (method) => {
      const res = await fetch(`${baseUrl}/api/products`, { method });

      expect(res.status).toBe(405);
    },
  );

  it('should not advertise the framework', async () => {
    const res = await fetch(`${baseUrl}/api/products/unknown/path`);

    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('products app - request body', () => {
  it('should answer 415 to a form-encoded body (CSRF defence)', async () => {
    const res = await post('/api/products', 'name=x', {
      'content-type': 'application/x-www-form-urlencoded',
    });

    expect(res.status).toBe(415);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should answer 400 to malformed JSON', async () => {
    const res = await post('/api/products', '{"name": ');

    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should answer 400 to a body above the size limit', async () => {
    const res = await post(
      '/api/products',
      JSON.stringify({ note: 'a'.repeat(20_000) }),
    );

    expect(res.status).toBe(400);
  });
});

describe('products app - authentication', () => {
  it('should answer 401 without a session', async () => {
    const res = await post('/api/products', validBody, { authorization: '' });

    expect(res.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should answer 403 for a blocked account', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await post('/api/products', validBody);

    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });
});
