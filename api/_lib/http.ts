import type { Request, Response } from 'express';
import { isObject } from '../../shared/validation.js';

export type Handler = (
  req: Request,
  res: Response,
) => unknown | Promise<unknown>;

type BodyHandler = (
  req: Request,
  res: Response,
  body: Record<string, unknown>,
) => unknown | Promise<unknown>;

export function sendTooManyRequests(res: Response) {
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

// Like withMethod, for a path that serves several methods: picks the handler of
// req.method and answers 405 for any other. Own property check, so that a method such as
// "constructor" never reaches an inherited property of the object.
export function withMethods(handlers: Record<string, Handler>): Handler {
  return (req, res) => {
    if (!Object.prototype.hasOwnProperty.call(handlers, req.method)) {
      return res.status(405).json({ message: 'Method not allowed' });
    }
    return handlers[req.method](req, res);
  };
}

// Rejects anything but a JSON body with 415, then a missing or non-object body
// with 400. The handler receives the body already narrowed.
// The content type check is a CSRF defence: a cross-site <form> can only send
// form-encoded or text/plain bodies without a CORS preflight. SameSite does
// not stop a cross-site request from *setting* a cookie, so login would accept
// one: the content type is checked explicitly instead of relying on the body
// parser, which merely skips bodies that are not JSON.
export function withObjectBody(handler: BodyHandler): Handler {
  return (req, res) => {
    if (!req.headers['content-type']?.startsWith('application/json')) {
      return res
        .status(415)
        .json({ message: 'Content-Type must be application/json' });
    }
    if (!isObject(req.body)) {
      return res
        .status(400)
        .json({ message: 'Missing or invalid request body' });
    }
    return handler(req, res, req.body);
  };
}

// Last handler of the app: a path no route matched. Express would otherwise
// answer with its default HTML page.
export function notFound(_req: Request, res: Response) {
  return res.status(404).json({ message: 'Not found' });
}
