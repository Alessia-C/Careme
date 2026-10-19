import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vi } from 'vitest';

// Fakes with only the members the handlers use. The casts are justified: the
// real Vercel types have many more members that the handlers never touch.
export function makeReq(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): VercelRequest {
  return { method, body, headers } as unknown as VercelRequest;
}

// Fake Supabase env vars so the client factories do not throw. Pair it with
// vi.unstubAllEnvs() in afterEach.
export function stubSupabaseEnv() {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
}

export function makeRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return { res, asVercel: res as unknown as VercelResponse };
}
