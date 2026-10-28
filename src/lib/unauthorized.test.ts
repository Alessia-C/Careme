import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './apiFetch';
import { handleUnauthorized, setUnauthorizedHandler } from './unauthorized';

describe('handleUnauthorized', () => {
  it('calls the registered handler for an UnauthorizedError', () => {
    const handler = vi.fn();
    const unregister = setUnauthorizedHandler(handler);

    handleUnauthorized(new UnauthorizedError());

    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('ignores any other error', () => {
    const handler = vi.fn();
    const unregister = setUnauthorizedHandler(handler);

    handleUnauthorized(new Error('boom'));
    handleUnauthorized('401');

    expect(handler).not.toHaveBeenCalled();
    unregister();
  });

  it('does nothing once the handler is unregistered', () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler)();

    handleUnauthorized(new UnauthorizedError());

    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps a newer handler when an older one unregisters late', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = setUnauthorizedHandler(first);
    const unregisterSecond = setUnauthorizedHandler(second);

    unregisterFirst();
    handleUnauthorized(new UnauthorizedError());

    expect(second).toHaveBeenCalledTimes(1);
    unregisterSecond();
  });
});
