import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReq, makeRes } from './test-helpers.js';
import { errorHandler } from './sentry.js';

const { captureException, flush } = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(),
}));

vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  captureException,
  flush,
}));

beforeEach(() => {
  vi.clearAllMocks();
  flush.mockResolvedValue(true);
});

describe('errorHandler', () => {
  it('should report the error and answer a generic 500', async () => {
    const { res, asExpress } = makeRes();
    const err = new Error('connection refused to db.internal:5432');

    await errorHandler(err, makeReq('POST'), asExpress, vi.fn());

    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { route: '/api/auth/test' },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
  });

  it('should keep the query string out of the Sentry route tag', async () => {
    const { asExpress } = makeRes();
    const req = makeReq('GET');
    Object.assign(req, { originalUrl: '/api/auth/me?email=a@b.c' });

    await errorHandler(new Error('x'), req, asExpress, vi.fn());

    expect(captureException).toHaveBeenCalledWith(expect.anything(), {
      tags: { route: '/api/auth/me' },
    });
  });

  it('should still answer 500 when flushing Sentry fails', async () => {
    flush.mockRejectedValue(new Error('network down'));
    const { res, asExpress } = makeRes();

    await errorHandler(new Error('x'), makeReq('POST'), asExpress, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should hand the error to Express when the response was already sent', async () => {
    const { res, asExpress } = makeRes();
    Object.assign(res, { headersSent: true });
    const next = vi.fn();
    const err = new Error('x');

    await errorHandler(err, makeReq('POST'), asExpress, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  it.each([
    ['entity.parse.failed', 400, 'Missing or invalid request body'],
    ['entity.too.large', 400, 'Missing or invalid request body'],
    ['charset.unsupported', 415, 'Content-Type must be application/json'],
    ['encoding.unsupported', 415, 'Content-Type must be application/json'],
  ])(
    'should answer %s with %i and not report it to Sentry',
    async (type, status, message) => {
      const { res, asExpress } = makeRes();

      await errorHandler(
        Object.assign(new Error('parser'), { type }),
        makeReq('POST'),
        asExpress,
        vi.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ message });
      expect(captureException).not.toHaveBeenCalled();
    },
  );
});
