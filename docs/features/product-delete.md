# Product delete

Lets a logged-in user permanently delete one of their own products, from the [product list](product-list.md) or from the [product detail](product-detail.md) drawer, after a confirmation.

|               |                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                                                           |
| **Issue**     | [#65](https://github.com/Alessia-C/Careme/issues/65) (API), [#70](https://github.com/Alessia-C/Careme/issues/70) (UI) |
| **Users**     | Logged-in user                                                                                                        |
| **Pages**     | `/` (modal on the home page, see [`src/router.tsx`](../../src/router.tsx))                                            |
| **Endpoints** | [`DELETE /api/products/:id`](../api/products-delete.md)                                                               |

## Behavior

### The flow

- The "Delete" button of a product card and the "Delete" button in the footer of the detail drawer (shown once the product is loaded) both ask the home page to delete that product. The page keeps it in `productToDelete`; the confirmation modal is open while there is one.
- [`DeleteProductModal`](../../src/pages/HomePage/components/DeleteProductModal/DeleteProductModal.tsx) uses the shared `Modal` (an `alertdialog`) with the title "Delete product", the text "Are you sure you want to remove this product?" and the buttons "Cancel" and "Delete" (error variant). It opens on top of the detail drawer when the drawer is open. A click on the backdrop does not close it.
- Cancel (also Esc) closes the modal and changes nothing; the drawer, if it was open, stays as it was. The last error is cleared, so it does not show the next time the modal opens.
- Confirm calls `DELETE /api/products/:id` (`deleteProduct` in [`src/lib/productsApi.ts`](../../src/lib/productsApi.ts)) through the [`useDeleteProduct`](../../src/hooks/useDeleteProduct/useDeleteProduct.ts) hook.
- While the request runs the confirm button reads "Deleting…" and is `aria-disabled` (not `disabled`, so it keeps the focus); a second click is ignored.
- On success the modal closes, the detail drawer closes if it was open, the list is asked again and the message "Product deleted successfully" appears. The focus moves to the page (`tabIndex={-1}`), because the card or the drawer that had it is gone.
- The message is a `Feedback` (success) fixed at the bottom left of the screen, inside an always-present `aria-live="polite"` region (only its content changes, so screen readers announce it). It disappears after 5 seconds; a second deletion restarts the timer.
- Deleting the last product leaves the list empty and the page shows the first access state (see [Product list](product-list.md)).

### States

- Confirming: the modal with "Cancel" and "Delete".
- Deleting: the confirm button reads "Deleting…"; the modal stays open.
- Error: the modal stays open with an error `Feedback` "Something went wrong" above the buttons, and the confirm button reads "Try again", which repeats the request. The text is "We couldn’t delete the product. Please try again." for network and server failures, and "Too many attempts. Please wait a moment and try again." for `429`. The product stays in the list.
- Session expired (`401`): handled by the shared request helper, as in [Session expiry](session-expiry.md).
- Success: see above.

### API contract

The client calls `DELETE /api/products/:id` with the id encoded in the path. `204` is a success. A `404` is also treated as a success: the product is already gone (for example deleted from another tab or session) or is not the user's, and either way it is not in their list, so the user sees the normal success message. Any other answer is a failure. Details of the endpoint are in [`docs/api/products-delete.md`](../api/products-delete.md).

## Business rules

- The deletion is permanent: there is no soft delete and no undo.
- A user can only delete their own products.
- The success answer is `204 No Content`, without a body.
- The `404` is the same for a missing product, a product of another user and an id that is not a uuid, so the answer never tells whether an id exists for someone else.
- A malformed id is answered without calling the database.
- A second `DELETE` on the same id answers `404`, because the product no longer exists. The page treats that `404` as a success.
- The page always asks for a confirmation before deleting.

## Data

Deletes one row of `products` by `id` ([migration](../../supabase/migrations/20260926094137_create_products.sql)). Nothing else is written: no other table references `products`. After a success the page removes the cached detail of the product (`['products', 'detail', <id>]`) and invalidates the `['products', 'list', ...]` queries, so the list is read again and a drawer opened later for the same id never shows it.

## Security and access

- Runs as the caller, so the RLS delete policy applies (`auth.uid() = user_id` and an `active` profile), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well. There is no admin bypass.
- A `blocked` user gets `403` from `withAuth`.
- Without a session the answer is `401`.
- The id sent comes from the product the user chose in their own list.

## Tests

- Unit tests (API): [`api/products/_routes/remove.test.ts`](../../api/products/_routes/remove.test.ts), [`shared/products.test.ts`](../../shared/products.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- Unit tests (UI):
  - [`src/pages/HomePage/components/DeleteProductModal/DeleteProductModal.test.tsx`](../../src/pages/HomePage/components/DeleteProductModal/DeleteProductModal.test.tsx)
  - [`src/hooks/useDeleteProduct/useDeleteProduct.test.tsx`](../../src/hooks/useDeleteProduct/useDeleteProduct.test.tsx)
  - [`src/lib/productsApi.test.ts`](../../src/lib/productsApi.test.ts)
  - [`src/components/Modal/Modal.test.tsx`](../../src/components/Modal/Modal.test.tsx) (`feedback`, `isConfirming`)
  - [`src/pages/HomePage/HomePage.test.tsx`](../../src/pages/HomePage/HomePage.test.tsx)
  - [`src/pages/HomePage/components/ProductCard/ProductCard.test.tsx`](../../src/pages/HomePage/components/ProductCard/ProductCard.test.tsx)
  - [`src/pages/HomePage/components/ProductDetailDrawer/ProductDetailDrawer.test.tsx`](../../src/pages/HomePage/components/ProductDetailDrawer/ProductDetailDrawer.test.tsx)
  - [`src/pages/HomePage/components/ProductList/ProductList.test.tsx`](../../src/pages/HomePage/components/ProductList/ProductList.test.tsx)
  - [`src/pages/HomePage/components/ProductListSection/ProductListSection.test.tsx`](../../src/pages/HomePage/components/ProductListSection/ProductListSection.test.tsx)
- E2E tests: None for the delete flow

## Open decisions

- No E2E test covers the delete flow yet. [`e2e/product-detail.spec.ts`](../../e2e/product-detail.spec.ts) still expects the drawer "Delete" button to be disabled (see the report).
- The visual match of the modal and the message with the Figma design (nodes 210:6127 and 191:3957) is to be checked in the browser.

## Changelog

| Date       | Change                                                                                                  | PR  |
| ---------- | ------------------------------------------------------------------------------------------------------- | --- |
| 2026-11-01 | Initial implementation                                                                                  | TBD |
| 2026-11-02 | Delete from the list and the detail drawer: confirmation modal, error with "Try again", success message | TBD |
