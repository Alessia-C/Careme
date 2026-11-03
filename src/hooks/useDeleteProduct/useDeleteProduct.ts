import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteProduct,
  productDetailKey,
  PRODUCTS_LIST_QUERY_KEY,
} from '../../lib/productsApi';

// Deletes a product and brings the cache in line: the list is asked again and
// the cached detail is dropped, so a drawer that opens for the same id later
// never shows it. The failures are values, not errors (see useSubmit), and
// `reset` clears the last one.
export function useDeleteProduct(onDeleted: () => void) {
  const queryClient = useQueryClient();
  const { mutate, isPending, data, reset } = useMutation({
    mutationFn: deleteProduct,
    onSuccess: (result, id) => {
      if (!result.ok) {
        return;
      }
      queryClient.removeQueries({ queryKey: productDetailKey(id) });
      void queryClient.invalidateQueries({
        queryKey: PRODUCTS_LIST_QUERY_KEY,
      });
      onDeleted();
    },
  });

  const remove = (id: string) => {
    if (!isPending) {
      mutate(id);
    }
  };

  const errorReason = data && !data.ok ? data.reason : null;

  return { remove, isDeleting: isPending, errorReason, reset };
}
