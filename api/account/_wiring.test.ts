// @vitest-environment node
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
import {
  startTestServer,
  stubSignedInSupabase,
  stubSupabaseEnv,
} from '../_lib/test-helpers.js';
import app from './index.js';

// These tests go through a real HTTP server, so they check the wiring that the
// route tests (which call the handlers directly) cannot see: routing, the body
// parser, the 404 and the order of the middleware.
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

let server: Awaited<ReturnType<typeof startTestServer>>;

beforeAll(async () => {
  server = await startTestServer(app);
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  stubSupabaseEnv();
  const query = stubSignedInSupabase(
    { getUser, rpc, single, from, createClient },
    { update, maybeSingle },
  );
  update.mockReturnValue(query);
  maybeSingle.mockResolvedValue({
    data: { first_name: 'Anna', last_name: 'Rossi' },
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const validBody = JSON.stringify({ first_name: 'Anna', last_name: 'Rossi' });

function send(
  method: string,
  path: string,
  body?: string,
  headers: Record<string, string> = {},
) {
  return fetch(`${server.baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer valid-token',
      ...headers,
    },
    body,
  });
}

describe('account app - routing', () => {
  it('should return the account on GET /api/account', async () => {
    const res = await send('GET', '/api/account');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      account: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      },
    });
  });

  it('should update the account on PUT /api/account', async () => {
    const res = await send('PUT', '/api/account', validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      account: {
        first_name: 'Anna',
        last_name: 'Rossi',
        email: 'jane@example.com',
      },
    });
  });

  it.each(['POST', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])(
    'should answer 405 to %s on /api/account',
    async (method) => {
      const res = await send(method, '/api/account');

      expect(res.status).toBe(405);
    },
  );

  it.each(['/api/account/unknown', '/api/Account'])(
    'should answer 404 with a JSON body on %s',
    async (path) => {
      const res = await send('GET', path);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ message: 'Not found' });
    },
  );

  it('should not advertise the framework', async () => {
    const res = await send('GET', '/api/account');

    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('account app - request body', () => {
  it('should answer 415 to a form-encoded body (CSRF defence)', async () => {
    const res = await send('PUT', '/api/account', 'first_name=x', {
      'content-type': 'application/x-www-form-urlencoded',
    });

    expect(res.status).toBe(415);
    expect(update).not.toHaveBeenCalled();
  });

  it('should answer 400 to malformed JSON', async () => {
    const res = await send('PUT', '/api/account', '{"first_name": ');

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('should answer 400 to a body above the size limit', async () => {
    const res = await send(
      'PUT',
      '/api/account',
      JSON.stringify({ first_name: 'a'.repeat(20_000) }),
    );

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('account app - authentication', () => {
  it.each(['GET', 'PUT'])(
    'should answer 401 to %s without a session',
    async (method) => {
      const body = method === 'PUT' ? validBody : undefined;

      const res = await send(method, '/api/account', body, {
        authorization: '',
      });

      expect(res.status).toBe(401);
      expect(from).not.toHaveBeenCalled();
    },
  );

  it('should answer 403 to a PUT from a blocked account', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await send('PUT', '/api/account', validBody);

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });
});
