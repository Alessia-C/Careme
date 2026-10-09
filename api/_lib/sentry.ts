import * as Sentry from '@sentry/node';
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
