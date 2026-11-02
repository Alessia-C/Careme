# Product update

Lets a logged-in user edit one of their own products from the [product detail](product-detail.md) drawer, which switches from view to edit mode, on top of `PUT /api/products/:id`.

|               |                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                                                                  |
| **Issue**     | [#64](https://github.com/Alessia-C/Careme/issues/64) (API), [#69](https://github.com/Alessia-C/Careme/issues/69) (edit mode) |
| **Users**     | Logged-in user                                                                                                               |
| **Pages**     | `/` (edit mode of the detail drawer on the home page, see [`src/router.tsx`](../../src/router.tsx))                          |
| **Endpoints** | [`PUT /api/products/:id`](../api/products-update.md)                                                                         |

## Behavior

### Entering edit mode

- In the detail drawer, the "Update" button switches it to edit mode. It is shown once the product is loaded. "Delete" stays disabled (see [Product detail](product-detail.md)).
- In edit mode the title is "Update Product" and there is no subtitle. The fields are the ones of [Add product](add-product.md), filled with the loaded product: Name\*, Brand\*, Category\*, Status\* and Note (a product without a note gives an empty field). The same component ([`ProductFields`](../../src/pages/HomePage/components/ProductFields/ProductFields.tsx)) renders them in both forms. The focus goes to Name. "Delete" is hidden.
- The buttons are "Save Changes" and "Cancel", in the shared [`DrawerForm`](../../src/components/DrawerForm/DrawerForm.tsx) (the structure that `FormDrawer` of Add product also uses).
- Each time edit mode is entered the form starts again from the loaded product, so a discarded edit is never shown again.

### Validation

- Validation is inline, next to each field, with the same rules as the API ([`shared/products.ts`](../../shared/products.ts), applied by [`src/lib/productForm.ts`](../../src/lib/productForm.ts)): a blank Name (empty or only spaces) shows "Name is required", a blank Brand shows "Brand is required", a Note over 500 characters shows "Note must be at most 500 characters".
- While a field has an error, a red `Feedback` "Validation Error" with "Please fix the errors" is also shown under the fields.
- "Save Changes" is disabled only while the form is invalid or being sent. It is **not** disabled when nothing changed: saving the same values is allowed and the API answers `200`.

### Saving

1. The button changes to its sending state and is disabled; "Cancel" is disabled too.
2. The app sends `PUT /api/products/:id` with the five fields (`updateProduct` in [`src/lib/productsApi.ts`](../../src/lib/productsApi.ts)). `name`, `brand` and `note` are trimmed by the API.
3. On success the drawer goes back to view mode: the title, the subtitle and the fields show the updated product, a closable success `Feedback` "Product updated successfully" is shown, the focus goes to "Update", and a visually hidden live region says "<name>, <brand>, updated".
4. The updated product is written in the detail cache (`['products', 'detail', <id>]`), after cancelling a detail request still in flight so an old answer cannot overwrite it. Only the list queries (`['products', 'list']`) are invalidated, so the list shows the new name, brand and the rest of the product.

### Errors

- Server error, network error or a body that is not a product: a red `Feedback` "Server Error" with "Something went wrong — We couldn’t save your product. Please try again." The typed values are kept and the user can press "Save Changes" again.
- `404` (the product no longer exists) and `403` (blocked user): the same "Server Error" message, so the form never tells why the save failed. On a `404` the `['products']` queries are invalidated, so the detail is asked again and the drawer then shows "Product not found".
- `429`: a red `Feedback` "Too many attempts" with "Please wait a moment and try again."
- `401`: the user is sent to `/login` (see [Session expiry](session-expiry.md)).
- A new attempt clears the previous error.

### Cancel and unsaved changes

A change is any difference from the loaded product **after trimming** (`useForm.isDirty`), so adding only spaces is not a change.

- "Cancel" without changes goes back to view mode at once, with no confirmation. The focus goes to "Update".
- "Cancel" with changes opens the "Unsaved changes" modal ([`UnsavedChangesModal`](../../src/components/UnsavedChangesModal/UnsavedChangesModal.tsx), an `alertdialog`): "You have unsaved changes. Are you sure you want to leave? Your changes will be lost." "Continue editing" (the main button) keeps the form as it is; "Discard" goes back to view mode and drops the changes. `Esc` in the modal is "Continue editing".
- The close (X) button and `Esc` of the drawer, in edit mode with changes, open the same modal; "Discard" then closes the whole drawer. Without changes they close the drawer at once.
- A click outside the detail drawer does not close it, in view or edit mode (`closeOnBackdropClick={false}` of `Drawer`), so a stray click cannot lose an edit.
- While the product is being saved, the X, `Esc` and the backdrop are ignored, and "Cancel" is disabled, because the answer is on its way.
- Navigation inside the app with changes (for example the browser Back button to another path) is held by [`useUnsavedChangesGuard`](../../src/hooks/useUnsavedChangesGuard/useUnsavedChangesGuard.ts), which uses `useBlocker` of React Router and opens the same modal: "Discard" lets the navigation go on, "Continue editing" cancels it. Going to `/login` (end of the session) is never blocked. Closing or reloading the tab shows the browser's own warning (`beforeunload`).

### Reusable pieces

[`UnsavedChangesModal`](../../src/components/UnsavedChangesModal/UnsavedChangesModal.tsx) and [`useUnsavedChangesGuard`](../../src/hooks/useUnsavedChangesGuard/useUnsavedChangesGuard.ts) are ready to be reused by [#165](https://github.com/Alessia-C/Careme/issues/165), which is not implemented yet.

## Business rules

- A user can only update their own products, and the owner never changes.
- The body is validated like [product creation](product-create.md): `name` and `brand` are required (1-100 characters after trimming), `category` is `skincare` or `makeup`, `status` is `new`, `used` or `finished`, `note` is optional (up to 500 characters after trimming). The form applies the same rules, but the server is the one that decides.
- The whole product is sent, not only what changed.
- `name`, `brand` and `note` are trimmed before they are saved. A blank `note` clears the old note.
- A NUL character in a text field is rejected (`400` from the API; the form flags it as invalid).
- Any other field in the body (`id`, `user_id`, `created_at`, ...) is ignored: only the five product fields are written.
- The `404` is the same for a missing product, a product of another user and an id that is not a uuid, so the answer never tells whether an id exists for someone else. The id is checked before the body.
- Sending the current values again is not an error: the answer is `200`.
- There is no duplicate check: a name and brand equal to another product are accepted.
- Concurrent edits from two sessions: the last write wins, with no conflict resolution.
- The product in the response has `id`, `name`, `brand`, `category`, `status`, `note` (`null` when there is none) and `created_at`. There is no `updated_at` column.

## Data

Updates one row of `products` by `id` ([migration](../../supabase/migrations/20260926094137_create_products.sql)): `name`, `brand`, `category`, `status` and `note`. `products.category` is `skincare | makeup` and `products.status` is `new | used | finished`. The frontend only talks to the API. After a save, the detail is written in the React Query cache and the lists are invalidated (`cacheUpdatedProduct` in [`src/lib/productsApi.ts`](../../src/lib/productsApi.ts)).

## Security and access

- Reached only through `ProtectedRoute`. The API runs as the caller, so the RLS update policy applies (`using`: `auth.uid() = user_id` and an `active` profile; `with check`: `auth.uid() = user_id`), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well.
- A `blocked` user gets `403` from `withAuth`; the form shows it as the generic "Server Error".
- Without a session the answer is `401`.
- `id` and `user_id` are never taken from the body, so a product cannot change owner.
- User text is rendered as text by React.

## Tests

- Unit tests (API): [`api/products/_routes/update.test.ts`](../../api/products/_routes/update.test.ts), [`api/products/_validation.test.ts`](../../api/products/_validation.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- Unit tests (UI):
  - [`src/pages/HomePage/components/ProductDetailDrawer/ProductDetailDrawer.test.tsx`](../../src/pages/HomePage/components/ProductDetailDrawer/ProductDetailDrawer.test.tsx)
  - [`src/pages/HomePage/components/ProductDetailDrawer/components/ProductEditForm/ProductEditForm.test.tsx`](../../src/pages/HomePage/components/ProductDetailDrawer/components/ProductEditForm/ProductEditForm.test.tsx)
  - [`src/pages/HomePage/HomePage.test.tsx`](../../src/pages/HomePage/HomePage.test.tsx)
  - [`src/lib/productsApi.test.ts`](../../src/lib/productsApi.test.ts) (`updateProduct`, `cacheUpdatedProduct`)
  - [`src/lib/productForm.test.ts`](../../src/lib/productForm.test.ts)
  - [`src/hooks/useForm/useForm.test.ts`](../../src/hooks/useForm/useForm.test.ts) (`isDirty`, `reset`)
  - [`src/hooks/useUnsavedChangesGuard/useUnsavedChangesGuard.test.tsx`](../../src/hooks/useUnsavedChangesGuard/useUnsavedChangesGuard.test.tsx)
  - [`src/components/UnsavedChangesModal/UnsavedChangesModal.test.tsx`](../../src/components/UnsavedChangesModal/UnsavedChangesModal.test.tsx)
  - [`src/components/DrawerForm/DrawerForm.test.tsx`](../../src/components/DrawerForm/DrawerForm.test.tsx)
  - [`src/components/Dialog/Dialog.test.tsx`](../../src/components/Dialog/Dialog.test.tsx), [`src/components/Drawer/Drawer.test.tsx`](../../src/components/Drawer/Drawer.test.tsx), [`src/components/Modal/Modal.test.tsx`](../../src/components/Modal/Modal.test.tsx)
- E2E tests: [`e2e/product-update.spec.ts`](../../e2e/product-update.spec.ts) (product updated and details refreshed, empty name refused before sending, server error keeps the form, Cancel with changes and Discard, Esc and outside click do not lose the changes)

## Open decisions

- Figma frame for the edit mode: the docs could not check the code against the design; the design needs to confirm the layout, the titles and the messages.
- Acceptance criterion "the list/detail reflect the update": the lists refresh by invalidation, so the changed card appears after the refetch, not at the same instant as the drawer. Confirm this is acceptable.

## Changelog

| Date       | Change                                                                                     | PR  |
| ---------- | ------------------------------------------------------------------------------------------ | --- |
| 2026-11-01 | Initial implementation (backend)                                                           | TBD |
| 2026-11-02 | Edit mode of the detail drawer: validation, unsaved-changes protection, cache update (#69) | TBD |
