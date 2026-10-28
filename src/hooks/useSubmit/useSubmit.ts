import { useMutation } from '@tanstack/react-query';
import type { SubmitEvent } from 'react';

type SubmitResult = { ok: true } | { ok: false; reason: string };

interface UseSubmitOptions<Result extends SubmitResult> {
  isValid: boolean;
  action: () => Promise<Result>;
  onSuccess: (result: Extract<Result, { ok: true }>) => void;
}

// Shared submit flow of the forms: ignores the submit when the form is
// invalid or already sending, and exposes the pending state and the reason
// of the last failure. The actions never throw: they report failures as
// `{ ok: false, reason }`, which is not an error for React Query.
export function useSubmit<Result extends SubmitResult>({
  isValid,
  action,
  onSuccess,
}: UseSubmitOptions<Result>) {
  const { mutate, isPending, data } = useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      if (result.ok) {
        onSuccess(result as Extract<Result, { ok: true }>);
      }
    },
  });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isPending) {
      return;
    }
    mutate();
  };

  // `data` is cleared by React Query when a new mutation starts.
  // TS narrows `reason` only to `string`, not to the reasons of this action.
  const errorReason =
    data && !data.ok
      ? (data.reason as Extract<Result, { ok: false }>['reason'])
      : null;

  return { isSubmitting: isPending, errorReason, handleSubmit };
}
