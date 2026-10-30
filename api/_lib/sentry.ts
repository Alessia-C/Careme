import * as Sentry from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'development',
    dataCollection: { userInfo: false },
    initialScope: { tags: { runtime: 'serverless' } },
  });
}

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>;

export function withSentry(handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      return await handler(req, res);
    } catch (err) {
      Sentry.captureException(err, { tags: { route: req.url ?? 'unknown' } });
      await Sentry.flush(2000);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ status: 'error', message: 'Internal server error' });
      }
    }
  };
}

// Errors of the body parser are the client's fault (a malformed body, an
// unsupported charset): they get a 4xx and are not reported to Sentry, which
// anybody could otherwise flood. An oversized body is mapped to the same 400:
// no new status code is introduced.
const BODY_PARSER_ERRORS: Record<string, { status: number; message: string }> =
  {
    'entity.parse.failed': {
      status: 400,
      message: 'Missing or invalid request body',
    },
    'entity.too.large': {
      status: 400,
      message: 'Missing or invalid request body',
    },
    'charset.unsupported': {
      status: 415,
      message: 'Content-Type must be application/json',
    },
    'encoding.unsupported': {
      status: 415,
      message: 'Content-Type must be application/json',
    },
  };

function getBodyParserError(err: unknown) {
  if (typeof err !== 'object' || err === null || !('type' in err)) {
    return undefined;
  }
  return typeof err.type === 'string'
    ? BODY_PARSER_ERRORS[err.type]
    : undefined;
}

// Express counterpart of withSentry: Express 5 forwards the errors thrown by
// async handlers here. It must never throw itself, or Express would answer with
// its default handler (stack trace outside production).
// The 4 parameters are what makes Express treat it as an error handler.
export async function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const bodyParserError = getBodyParserError(err);
  if (bodyParserError && !res.headersSent) {
    return res
      .status(bodyParserError.status)
      .json({ message: bodyParserError.message });
  }

  // originalUrl without the query string, which may hold personal data.
  const route = req.originalUrl.split('?')[0];
  Sentry.captureException(err, { tags: { route } });
  try {
    await Sentry.flush(2000);
  } catch {
    // Flushing is best effort: the response must be sent anyway.
  }

  if (res.headersSent) {
    return next(err);
  }
  return res
    .status(500)
    .json({ status: 'error', message: 'Internal server error' });
}
