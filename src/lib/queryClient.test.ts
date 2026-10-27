import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './apiFetch';
import { queryClient } from './queryClient';
import { setUnauthorizedHandler } from './unauthorized';

afterEach(() => {
  queryClient.clear();
});

describe('queryClient', () => {
  it('reports a 401 from a query to the unauthorized handler, without retrying', async () => {
    const handler = vi.fn();
    const unregister = setUnauthorizedHandler(handler);
    const queryFn = vi.fn().mockRejectedValue(new UnauthorizedError());

    await expect(
      queryClient.fetchQuery({ queryKey: ['products'], queryFn }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('reports a 401 from a mutation to the unauthorized handler', async () => {
    const handler = vi.fn();
    const unregister = setUnauthorizedHandler(handler);

    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => Promise.reject(new UnauthorizedError()),
      })
      .execute(undefined)
      .catch(() => {});

    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('does not retry a query that failed with 401', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') {
      throw new Error('retry should be a function');
    }

    expect(retry(0, new UnauthorizedError())).toBe(false);
    expect(retry(0, new Error('network'))).toBe(true);
    expect(retry(3, new Error('network'))).toBe(false);
  });
});
