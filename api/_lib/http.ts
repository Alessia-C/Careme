import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isObject } from '../../shared/validation.js';

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>;

type BodyHandler = (
  req: VercelRequest,
  res: VercelResponse,
  body: Record<string, unknown>,
) => unknown | Promise<unknown>;

export function sendTooManyRequests(res: VercelResponse) {
  return res
    .status(429)
    .json({ message: 'Too many requests, please try again later' });
}

// Rejects any other HTTP method with 405 before the handler runs.
export function withMethod(method: string, handler: Handler): Handler {
  return (req, res) => {
    if (req.method !== method) {
      return res.status(405).json({ message: 'Method not allowed' });
    }
    return handler(req, res);
  };
}

// Rejects a missing or non-object body with 400. The handler receives the body
// already narrowed, so it does not need to re-check it.
export function withObjectBody(handler: BodyHandler): Handler {
  return (req, res) => {
    if (!isObject(req.body)) {
      return res
        .status(400)
        .json({ message: 'Missing or invalid request body' });
    }
    return handler(req, res, req.body);
  };
}
