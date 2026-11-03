# Product detail

Lets a logged-in user open one of their own products from the [product list](product-list.md) in a drawer, with all its fields, including the note that the list leaves out. From the drawer the user can switch to edit mode (see [Product update](product-update.md)).

|               |                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                                                                                                                                 |
| **Issue**     | [#63](https://github.com/Alessia-C/Careme/issues/63) (API), [#68](https://github.com/Alessia-C/Careme/issues/68) (drawer), [#69](https://github.com/Alessia-C/Careme/issues/69) (edit mode) |
| **Users**     | Logged-in user                                                                                                                                                                              |
| **Pages**     | `/` (drawer on the home page, see [`src/router.tsx`](../../src/router.tsx))                                                                                                                 |
| **Endpoints** | [`GET /api/products/:id`](../api/products-detail.md)                                                                                                                                        |

## Behavior

### The drawer

- The "Detail" button of a product card opens a side drawer ([`ProductDetailDrawer`](../../src/pages/HomePage/components/ProductDetailDrawer/ProductDetailDrawer.tsx)). The drawer is a `<dialog>` (via `Drawer` and `Dialog`), so it is announced as a dialog, traps the focus, and closes with Esc or the close button (X). A click on the overlay does **not** close it (`closeOnBackdropClick={false}`), so a stray click cannot lose an edit.
- On close, the focus goes back to the "Detail" button that opened it. The page gives the drawer a new `key` on every open, so it mounts again each time.
- The title is the product name and the subtitle is the brand. The subtitle also describes the dialog for screen readers (`aria-describedby`, before the description if a dialog has both). The name and the brand come from the product card that opened the drawer, so they are the title from the first moment, while the product loads and when it fails. Once loaded, the name and brand of the product replace them. When the product loads, a visually hidden live region in the drawer says "<name>, <brand>, loaded", because the new title is not announced by itself.
- The body is a description list with Category (Skincare or Makeup), Status (New, Used or Finished) and Note. A missing note shows "No note" in a muted style, with no empty value. Long text wraps. A long note scrolls inside the body while the buttons stay at the bottom. The body is a focusable region named "Product details", so the keyboard can scroll it in Safari too.
- The footer has the "Update" and "Delete" buttons, shown only once the product is loaded. "Update" switches the drawer to edit mode (see [Product update](product-update.md)): the title becomes "Update Product", the fields are editable and "Delete" is hidden. "Delete" opens the confirmation modal of [Product delete](product-delete.md) on top of the drawer; after a successful deletion the drawer closes and stops asking for the product. Cancelling the modal leaves the drawer as it was.
- After a save the drawer is back in view mode with the updated product, a success message "Product updated successfully" with no close button, and the focus on "Update". The success message is the only one announced: the live region says "<name>, <brand>, loaded" once and does not repeat it.
- There is no Cancel button, so on a phone the close button (X) stays visible (`showCloseOnMobile`). In the add product drawer it is hidden on phones, where the form has its own Cancel.
- A product deleted from the drawer closes it. Opening another product shows the newly selected one. The selected id lives in the state of the home page (`selectedProductId`), not in the URL.
- The user text (name, brand, note) is rendered as text by React.

### States

- Loading: a `ContentState` with a loader and "Loading product…". If the product is already in the cache (for example it was opened before), it is shown at once.
- Not found: a red `ContentState` "Product not found" with "It may no longer be available.", and no "Try again". It is shown for `404` and for `403`, so the screen never tells whether an id exists or why it cannot be read.
- Error (network, server, `429`, a body that is not a product): a red `ContentState` "We couldn’t load the product" with "Please check your connection and try again." and a "Try again" button that repeats the request. A failed request hides the cached product, so a product removed from another tab is not kept on screen. "Try again" moves the focus to the content of the drawer, because the button is replaced by the loader as soon as the request starts.
- The request is retried once automatically before the error is shown. A `401` and a not found are not retried; a `401` ends the session (see [Session expiry](session-expiry.md)).
- A product loaded in the last 30 seconds is not asked again when the drawer opens: the cached one is shown. After that it is shown at once and asked again, so a change made from another tab appears. It is not asked again on window focus or on reconnect. Creating a product refreshes the list only, not the details already loaded. Updating a product writes the new detail in the cache and refreshes the lists.

### API contract

The client calls `GET /api/products/:id` with the id encoded in the path (`getProduct` in [`src/lib/productsApi.ts`](../../src/lib/productsApi.ts)). It accepts a `200` whose `product` has the list fields and a `note` that is a string or `null`; any other body is a failure. Details of the endpoint are in [`docs/api/products-detail.md`](../api/products-detail.md).

## Business rules

- A user can only read their own products.
- The `404` is the same for a missing product, a product of another user and an id that is not a uuid, so the answer never tells whether an id exists for someone else. The drawer shows the same "Product not found" for those and for a `403`.
- A malformed id is answered without calling the database.
- The product has `id`, `name`, `brand`, `category`, `status`, `note` (`null` when there is none) and `created_at`. The drawer shows name, brand, category, status and note.
- In view mode the only change the drawer can start besides editing is the deletion, which asks for a confirmation first; changes are made in edit mode, described in [Product update](product-update.md).

## Data

Reads one row of `products` by `id` ([migration](../../supabase/migrations/20260926094137_create_products.sql)); the primary key index serves the lookup. The drawer keeps the product in the React Query cache under `['products', 'detail', <id>]` ([`useProduct`](../../src/hooks/useProduct/useProduct.ts)), inside the `['products']` family that is invalidated when a product is added. After an update the detail is written in the cache with `setQueryData`.

## Security and access

- Runs as the caller, so the RLS select policy applies (`auth.uid() = user_id` and an `active` profile), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well.
- A `blocked` user gets `403` from `withAuth`; the drawer shows it as "Product not found".
- View mode writes nothing by itself. Saving an edit is covered in [Product update](product-update.md). "Delete" calls `DELETE /api/products/:id` only after the user confirms (see [Product delete](product-delete.md)), and a deletion removes the cached detail of the product.

## Tests

- Unit tests (API): [`api/products/_routes/detail.test.ts`](../../api/products/_routes/detail.test.ts), [`shared/products.test.ts`](../../shared/products.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- Unit tests (UI):
  - [`src/pages/HomePage/components/ProductDetailDrawer/ProductDetailDrawer.test.tsx`](../../src/pages/HomePage/components/ProductDetailDrawer/ProductDetailDrawer.test.tsx)
  - [`src/pages/HomePage/HomePage.test.tsx`](../../src/pages/HomePage/HomePage.test.tsx)
  - [`src/pages/HomePage/components/DeleteProductModal/DeleteProductModal.test.tsx`](../../src/pages/HomePage/components/DeleteProductModal/DeleteProductModal.test.tsx) (delete from the drawer)
  - [`src/hooks/useProduct/useProduct.test.tsx`](../../src/hooks/useProduct/useProduct.test.tsx)
  - [`src/lib/productsApi.test.ts`](../../src/lib/productsApi.test.ts)
  - [`src/components/Drawer/Drawer.test.tsx`](../../src/components/Drawer/Drawer.test.tsx) (`subtitle`, `footer`, `showCloseOnMobile`)
  - [`src/components/Dialog/Dialog.test.tsx`](../../src/components/Dialog/Dialog.test.tsx)
  - Edit mode: see the tests listed in [Product update](product-update.md)
- E2E tests: [`e2e/product-detail.spec.ts`](../../e2e/product-detail.spec.ts) (open, Esc and focus back, close button, retry after a server error, not found without retry, close button on a phone). Edit mode: [`e2e/product-update.spec.ts`](../../e2e/product-update.spec.ts)

## Open decisions

- The issue says the selected product "lives only in the store", but the code keeps `selectedProductId` in the `useState` of `HomePage`. Confirm whether it must move to a Zustand store.
- Figma frame "product-detail": the docs could not check the code against the design; the design needs to confirm the layout and the "No note" text.

## Changelog

| Date       | Change                                                                                                                                              | PR  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 2026-11-01 | Initial implementation (backend)                                                                                                                    | TBD |
| 2026-11-02 | Read-only detail drawer on the home page, `useProduct`                                                                                              | TBD |
| 2026-11-02 | The scrolling body is a keyboard-reachable region; `Dialog` describes itself with the subtitle and the description together                         | TBD |
| 2026-11-02 | Title and subtitle are the name and brand of the product card from the first moment, not "Product detail"                                           | TBD |
| 2026-11-02 | Loaded product announced to screen readers; focus kept after "Try again"; product cached for 30 seconds; creating a product refreshes the list only | TBD |
| 2026-11-02 | The drawer has an edit mode (#69): "Update" enabled, backdrop click no longer closes it; "Delete" still disabled                                    | TBD |
| 2026-11-02 | "Delete" enabled: opens the confirmation modal, the drawer closes after a deletion                                                                  | TBD |
