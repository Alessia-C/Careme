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

export function makeRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return { res, asVercel: res as unknown as VercelResponse };
}
