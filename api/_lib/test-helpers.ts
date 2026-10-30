import type { Request, Response } from 'express';
import { vi } from 'vitest';
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
// only call status, json and setHeader.
export function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
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
