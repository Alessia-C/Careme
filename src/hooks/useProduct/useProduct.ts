import { skipToken, useQuery } from '@tanstack/react-query';
import { UnauthorizedError } from '../../lib/apiFetch';
import { getProduct, productDetailKey } from '../../lib/productsApi';

// Same reason as the list: the default is 3 retries with backoff, which would
// keep the user waiting before the error and its "Try again" button appear.
const DETAIL_RETRIES = 1;

// The product is not there for this user (missing, someone else's, not a valid
// id). Asking again gives the same answer, so it is not retried.
class ProductNotFoundError extends Error {
  constructor() {
    super('Product not found');
    this.name = 'ProductNotFoundError';
  }
}

// One product of the user, for the detail drawer. A null id asks for nothing.
export function useProduct(id: string | null) {
  const query = useQuery({
    queryKey: productDetailKey(id),
    queryFn:
      id === null
        ? skipToken
        : async () => {
            const result = await getProduct(id);
            // getProduct reports failures as values; React Query needs a throw
            // to enter the error state.
            if (!result.ok) {
              throw result.reason === 'not-found'
                ? new ProductNotFoundError()
                : new Error(`Product request failed (${result.reason})`);
            }
            return result.product;
          },
    // The product can change from another tab, so what is in the cache is shown
    // at once and asked again when the drawer mounts. Focus and reconnect do
    // not ask: the drawer is open for a short time.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) =>
      !(error instanceof UnauthorizedError) &&
      !(error instanceof ProductNotFoundError) &&
      failureCount < DETAIL_RETRIES,
  });

  return {
    product: query.data,
    isPending: query.isPending,
    isError: query.isError,
    isNotFound: query.error instanceof ProductNotFoundError,
    refetch: query.refetch,
  };
}
