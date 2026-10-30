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
import { getSessionCookieName } from '../_lib/auth.js';
import { stubSupabaseEnv } from '../_lib/test-helpers.js';
import app from './_app.js';

// These tests go through a real HTTP server, so they check the wiring that the
// route tests (which call the handlers directly) cannot see: routing, the body
// parser, the 404 and the order of the middleware.
const { getUser, signOut, rpc, single, from, createClient, captureException } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    signOut: vi.fn(),
    rpc: vi.fn(),
    single: vi.fn(),
    from: vi.fn(),
    createClient: vi.fn(),
    captureException: vi.fn(),
  }));

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient,
}));

vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  captureException,
  flush: vi.fn(),
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  stubSupabaseEnv();
  const query = { select: vi.fn(), eq: vi.fn(), single };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  from.mockReturnValue(query);
  createClient.mockReturnValue({
    auth: { getUser, admin: { signOut } },
    rpc,
    from,
  });
  getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@example.com' } },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
  single.mockResolvedValue({ data: { role: 'user' }, error: null });
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function post(path: string, body: string, contentType = 'application/json') {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

describe('auth app - routing', () => {
  it('should answer 404 with a JSON body for an unknown path', async () => {
    const res = await fetch(`${baseUrl}/api/auth/unknown`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Not found' });
  });

  it('should treat the path as case sensitive', async () => {
    const res = await post('/api/auth/LOGIN', '{}');

    expect(res.status).toBe(404);
  });

  it.each(['PUT', 'DELETE', 'OPTIONS', 'HEAD'])(
    'should answer 405 to %s on a POST-only route',
    async (method) => {
      const res = await fetch(`${baseUrl}/api/auth/login`, { method });

      expect(res.status).toBe(405);
    },
  );

  it('should not advertise the framework', async () => {
    const res = await fetch(`${baseUrl}/api/auth/unknown`);

    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('auth app - request body', () => {
  it('should answer 415 to a form-encoded body (CSRF defence)', async () => {
    const res = await post(
      '/api/auth/login',
      'email=a%40b.c&password=x',
      'application/x-www-form-urlencoded',
    );

    expect(res.status).toBe(415);
  });

  it('should answer 400 to malformed JSON without reporting it to Sentry', async () => {
    const res = await post('/api/auth/login', '{"email": ');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      message: 'Missing or invalid request body',
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('should answer 400 to an empty body', async () => {
    const res = await post('/api/auth/login', '');

    expect(res.status).toBe(400);
  });

  it('should answer 400 to a body above the size limit', async () => {
    const res = await post(
      '/api/auth/login',
      JSON.stringify({ email: 'a'.repeat(20_000) }),
    );

    expect(res.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe('auth app - authentication', () => {
  it('should answer 401 to /me without a session', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);

    expect(res.status).toBe(401);
  });

  it('should answer 403 to /me for a blocked account', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.status).toBe(403);
  });

  it('should read the session from the cookie sent by the browser', async () => {
    // /me reads the exp claim, so the token must look like a JWT.
    const payload = Buffer.from(JSON.stringify({ exp: 1790000000 }));
    const token = `h.${payload.toString('base64url')}.s`;

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: `${getSessionCookieName()}=${token}` },
    });

    expect(res.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith(token);
  });

  it('should let a blocked account log out and clear both cookies', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: '{}',
    });

    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });

  it('should keep the cleared cookies on the generic 500', async () => {
    signOut.mockResolvedValue({ error: new Error('db.internal:5432 down') });

    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: '{}',
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: 'error',
      message: 'Internal server error',
    });
    expect(res.headers.getSetCookie()).toHaveLength(2);
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
