import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReq, makeRes } from './test-helpers.js';
import {
  errorHandler,
  scrubRequestData,
  sentryDataCollection,
} from './sentry.js';

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

  it('should not send the details or the hint of a database error to Sentry', async () => {
    const { asExpress } = makeRes();
    const dbError = Object.assign(new Error('violates check constraint'), {
      code: '23514',
      details: 'Failing row contains (1, Secret cream, Secret brand)',
      hint: 'Secret hint',
    });

    await errorHandler(dbError, makeReq('POST'), asExpress, vi.fn());

    const [reported] = captureException.mock.calls[0];
    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).toBe('violates check constraint (code 23514)');
    expect(JSON.stringify(reported)).not.toContain('Secret');
    expect(reported).not.toHaveProperty('details');
    expect(reported).not.toHaveProperty('hint');
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

describe('Sentry data collection', () => {
  it('should switch off bodies, cookies, headers, query strings and local variables', () => {
    // These carry passwords and session or recovery tokens: with
    // `dataCollection` set the SDK collects them unless told otherwise.
    expect(sentryDataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    });
  });

  it('should remove the request body and cookies from an event', () => {
    const event = {
      request: {
        url: 'https://careme.example/api/auth/reset',
        data: { accessToken: 'secret', password: 'Secret123!' },
        cookies: { 'sb-access-token': 'secret' },
      },
    };

    expect(scrubRequestData(event)).toEqual({
      request: { url: 'https://careme.example/api/auth/reset' },
    });
  });

  it('should leave an event without a request untouched', () => {
    expect(scrubRequestData({})).toEqual({});
  });
});
