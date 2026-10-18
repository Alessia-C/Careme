import { describe, expect, it, vi } from 'vitest';
import { sendTooManyRequests, withMethod, withObjectBody } from './http.js';
import { makeReq, makeRes } from './test-helpers.js';

describe('withMethod', () => {
  it('should call the handler when the method matches', async () => {
    const handler = vi.fn();
    const { asVercel } = makeRes();
    const req = makeReq('POST');

    await withMethod('POST', handler)(req, asVercel);

    expect(handler).toHaveBeenCalledWith(req, asVercel);
  });

  it('should return 405 and skip the handler for another method', async () => {
    const handler = vi.fn();
    const { res, asVercel } = makeRes();

    await withMethod('POST', handler)(makeReq('GET'), asVercel);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ message: 'Method not allowed' });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('withObjectBody', () => {
  it('should pass the body to the handler when it is an object', async () => {
    const handler = vi.fn();
    const { asVercel } = makeRes();
    const body = { email: 'test@example.com' };
    const req = makeReq('POST', body);

    await withObjectBody(handler)(req, asVercel);

    expect(handler).toHaveBeenCalledWith(req, asVercel, body);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not an object'],
  ])(
    'should return 400 and skip the handler when the body is %s',
    async (_label, body) => {
      const handler = vi.fn();
      const { res, asVercel } = makeRes();

      await withObjectBody(handler)(makeReq('POST', body), asVercel);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Missing or invalid request body',
      });
      expect(handler).not.toHaveBeenCalled();
    },
  );
});

describe('sendTooManyRequests', () => {
  it('should answer 429 with a retry message', () => {
    const { res, asVercel } = makeRes();

    sendTooManyRequests(asVercel);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Too many requests, please try again later',
    });
  });
});
