import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { UnauthorizedError } from '../../lib/apiFetch';
import {
  listProducts,
  PRODUCTS_QUERY_KEY,
  type ProductListItem,
} from '../../lib/productsApi';

// A multiple of the 3 columns of the grid, within the API maximum (20).
export const PRODUCTS_PAGE_SIZE = 12;

// The default is 3 retries with backoff, which would keep the user waiting
// several seconds before the error and its "Try again" button appear.
const LIST_RETRIES = 1;

// Products created between two "Load more" shift the offsets, so a product can
// come in two pages: keep the first one, or React sees a duplicate key.
function uniqueById(products: ProductListItem[]) {
  const seenIds = new Set<string>();
  return products.filter((product) => {
    if (seenIds.has(product.id)) {
      return false;
    }
    seenIds.add(product.id);
    return true;
  });
}

// The list of the user's products, one page at a time ("Load more"). An empty
// search means no filter.
export function useProducts(search: string) {
  const query = useInfiniteQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'list', search],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const result = await listProducts({
        search,
        offset: pageParam,
        limit: PRODUCTS_PAGE_SIZE,
      });
      // listProducts reports failures as values; React Query needs a throw to
      // enter the error state.
      if (!result.ok) {
        throw new Error(`Products request failed (${result.reason})`);
      }
      return result;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (count, page) => count + page.products.length,
        0,
      );
      return loaded < lastPage.total ? loaded : undefined;
    },
    // No polling: the list changes only when this user changes it, so it is
    // never stale by time. Creating a product invalidates it, and "Try again"
    // and a new search ask the API on their own. Focus and reconnect do not.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) =>
      !(error instanceof UnauthorizedError) && failureCount < LIST_RETRIES,
    // The old list stays on screen while a new search loads: the page does not
    // flash a loader and the search field keeps the focus.
    placeholderData: keepPreviousData,
  });

  // Memoized on the query data: the list keeps its identity between renders
  // that do not change it, so the memoized ProductList is not rendered again.
  const { products, total } = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return {
      products: uniqueById(pages.flatMap((page) => page.products)),
      total: pages[pages.length - 1]?.total ?? 0,
    };
  }, [query.data]);

  return {
    products,
    total,
    isPending: query.isPending,
    isError: query.isError,
    isFetchNextPageError: query.isFetchNextPageError,
    isPlaceholderData: query.isPlaceholderData,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
