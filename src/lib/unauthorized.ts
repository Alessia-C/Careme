import { UnauthorizedError } from './apiFetch';

let handler: (() => void) | null = null;

// The query client lives outside React, while ending a session needs hooks
// (router, store): a component registers the handler while it is mounted.
// Returns the function that unregisters it.
export function setUnauthorizedHandler(onUnauthorized: () => void) {
  handler = onUnauthorized;
  return () => {
    if (handler === onUnauthorized) {
      handler = null;
    }
  };
}

export function handleUnauthorized(error: unknown) {
  if (error instanceof UnauthorizedError) {
    handler?.();
  }
}
