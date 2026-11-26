import type { AddressInfo } from 'node:net';
import type { Express, Request, Response } from 'express';
import { vi, type Mock } from 'vitest';
import { errorHandler } from './sentry.js';

// Fakes with only the members the handlers use. The casts are justified: the
// real Express types have many more members that the handlers never touch.
export function makeReq(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {},
): Request {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
  return {
    method,
    body,
    originalUrl: '/api/auth/test',
    headers: {
      'content-type': 'application/json',
      ...(cookie && { cookie }),
      ...headers,
    },
  } as unknown as Request;
}

// Fake Supabase env vars so the client factories do not throw. Pair it with
// vi.unstubAllEnvs() in afterEach.
export function stubSupabaseEnv() {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
}

// Same kind of fake as makeReq: a partial Response, cast because the handlers
// only call status, json, end and setHeader.
export function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
  };
  return { res, asExpress: res as unknown as Response };
}

// Express 5 forwards what an async handler throws to the error handler. The
// route tests call the handler directly, so this wrapper does the same hand-off
// and they can still check the 500 the client would receive.
export function withErrorHandler(
  handler: (req: Request, res: Response) => unknown,
) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (err) {
      await errorHandler(err, req, res, vi.fn());
    }
  };
}

// Starts the app on an ephemeral port, for the tests that go through real HTTP.
export async function startTestServer(app: Express) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  // address() is string | AddressInfo | null; after listen(0) on TCP it is
  // always an AddressInfo.
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => server.close(),
  };
}

type SupabaseFakes = Record<
  'getUser' | 'rpc' | 'single' | 'from' | 'createClient',
  Mock
>;

// A fake Supabase for which withAuth accepts the caller: an active user named
// Jane Doe. The query methods chain like in the real client; `methods` adds the
// ones a test needs besides select, eq and single. Returns the query object.
export function stubSignedInSupabase(
  { getUser, rpc, single, from, createClient }: SupabaseFakes,
  methods: Record<string, Mock> = {},
) {
  const query = { select: vi.fn(), eq: vi.fn(), single, ...methods };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  from.mockReturnValue(query);
  createClient.mockReturnValue({ auth: { getUser }, rpc, from });
  getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'jane@example.com' } },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
  single.mockResolvedValue({
    data: { role: 'user', first_name: 'Jane', last_name: 'Doe' },
    error: null,
  });
  return query;
}
