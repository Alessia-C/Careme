import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode, SubmitEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSubmit } from './useSubmit';

type Result = { ok: true } | { ok: false; reason: 'failed' };

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

const submitEvent = () =>
  ({ preventDefault: vi.fn() }) as unknown as SubmitEvent<HTMLFormElement>;

const renderSubmit = (
  action: () => Promise<Result>,
  { isValid = true, onSuccess = vi.fn() } = {},
) => renderHook(() => useSubmit({ isValid, action, onSuccess }), { wrapper });

describe('useSubmit', () => {
  it('runs the action on submit and reports success', async () => {
    const onSuccess = vi.fn();
    const action = vi.fn(() => Promise.resolve<Result>({ ok: true }));
    const { result } = renderSubmit(action, { onSuccess });

    act(() => result.current.handleSubmit(submitEvent()));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.errorReason).toBeNull();
  });

  it('does not run the action when the form is not valid', () => {
    const action = vi.fn(() => Promise.resolve<Result>({ ok: true }));
    const { result } = renderSubmit(action, { isValid: false });
    const event = submitEvent();

    act(() => result.current.handleSubmit(event));

    expect(action).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ignores a second submit while the first is being sent', async () => {
    const action = vi.fn(() => new Promise<Result>(() => undefined));
    const { result } = renderSubmit(action);

    act(() => result.current.handleSubmit(submitEvent()));
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    act(() => result.current.handleSubmit(submitEvent()));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('exposes the reason of a failure, without calling onSuccess', async () => {
    const onSuccess = vi.fn();
    const { result } = renderSubmit(
      () => Promise.resolve<Result>({ ok: false, reason: 'failed' }),
      { onSuccess },
    );

    act(() => result.current.handleSubmit(submitEvent()));

    await waitFor(() => expect(result.current.errorReason).toBe('failed'));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('forgets the last failure on reset', async () => {
    const { result } = renderSubmit(() =>
      Promise.resolve<Result>({ ok: false, reason: 'failed' }),
    );
    act(() => result.current.handleSubmit(submitEvent()));
    await waitFor(() => expect(result.current.errorReason).toBe('failed'));

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.errorReason).toBeNull());
  });
});
