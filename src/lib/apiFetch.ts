// Thrown when a protected endpoint answers 401: the session is over. The
// QueryCache / MutationCache `onError` (see queryClient.ts) listens for it.
export class UnauthorizedError extends Error {
  constructor() {
    super('Session expired or invalid');
    this.name = 'UnauthorizedError';
  }
}

// Only for protected endpoints, inside a queryFn / mutationFn. The /api/auth/*
// endpoints have their own 401 handling (wrong credentials, session restore),
// so they keep using plain fetch.
export async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  return response;
}
