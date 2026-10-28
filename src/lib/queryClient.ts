import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { UnauthorizedError } from './apiFetch';
import { handleUnauthorized } from './unauthorized';

const DEFAULT_RETRIES = 3;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      // Retrying a 401 cannot help: the session is gone.
      retry: (failureCount, error) =>
        !(error instanceof UnauthorizedError) && failureCount < DEFAULT_RETRIES,
    },
  },
});
