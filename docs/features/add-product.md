# Add product

Lets a logged-in user add a product (name, brand, category, status, optional note) from a drawer opened on the home page. Before creating it, the app checks that the user does not already have a product with the same name and brand.

|               |                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Status**    | In progress                                                                                                                    |
| **Issue**     | [#66](https://github.com/Alessia-C/Careme/issues/66)                                                                           |
| **Users**     | Logged-in user                                                                                                                 |
| **Pages**     | `/` (see [`src/router.tsx`](../../src/router.tsx))                                                                             |
| **Endpoints** | [`GET /api/products`](../api/products-list.md) (duplicate check), [`POST /api/products`](../api/products-create.md) (creation) |

## Behavior

### The page

- `/` shows the title "Your products" and, because the product list does not exist yet (MK-031), always the first-access empty state: an `EmptyState` with a plus icon, the title "Add your product", the text "Start by adding your first product to manage your catalog" and an "Add product" button.
- The button opens the "Add Product" drawer (a full-height side panel on the right, built on the native `<dialog>`: `AddProductDrawer` provides the fields and the submit logic, `FormDrawer` the structure shared by form drawers: title, scrolling fields, messages and the submit and Cancel buttons).
- After a successful creation the drawer closes and the page stays on the empty state, since there is no list to show the new product yet.

### The drawer

- Fields:
  - Name\* (text, required, up to 100 characters).
  - Brand\* (text, required, up to 100 characters).
  - Category\* (select: Makeup, Skincare). Default: Makeup.
  - Status\* (select: New, Used, Finished). Default: New.
  - Note (textarea, optional, up to 500 characters).
- The two selects always hold a valid value, so the form can never be sent with an empty category or status.
- Validation is inline, next to each field, on the same rules as the API ([`shared/products.ts`](../../shared/products.ts)): a blank Name shows "Name is required", a blank Brand shows "Brand is required", a Note longer than 500 characters shows "Note must be at most 500 characters". The "Add Product" button is disabled while the form is invalid.
- The form always starts empty with the defaults: the page remounts the drawer every time it opens, so nothing typed before is shown again.

### Submitting

1. The button changes to "Adding…" and is disabled while the request runs.
2. The app first asks `GET /api/products?name=<name>&brand=<brand>&limit=1` with the trimmed values.
3. If the first product returned has exactly the same trimmed name and brand, the app does not create anything and shows the duplicate state (below).
4. Otherwise the app sends `POST /api/products`.
5. On success the `['products']` query is invalidated and the drawer closes.

### Duplicate

- The Name and Brand fields turn red, a yellow alert "Duplicate product found" says "A product named **Name** by **Brand** already exists in your catalog.", and the "Add Product" button is disabled.
- It lasts until the user changes Name or Brand (compared after trimming); then the alert goes away and the button is enabled again. Changing Category, Status or Note does not clear it.
- There is no "add anyway" and no "go update the existing one": the design does not include them.

### Errors

- Server or network error (in the check or in the creation): a red alert "Something went wrong" with "We couldn’t add the product. Please try again." The typed values are kept and the user can press the button again.
- `429`: the same alert with "Too many attempts. Please wait a moment and try again."
- `401`: the user is sent to `/login` (see [Session expiry](session-expiry.md)).
- A new attempt clears the previous alert.

### Closing

- Cancel, the close (X) button, `Esc` and a click on the backdrop close the drawer. Nothing is created and the typed values are discarded. The focus goes back to the "Add product" button.

## Business rules

- A product is created only if the pre-check does not find a product with the same trimmed `name` and `brand`. The comparison is exact and case sensitive, like the API's.
- The client accepts the pre-check result only when the first product returned has exactly the same name and brand. If the API returned an unrelated product (for example because it ignores the filters), the user is not blocked.
- The check and the creation are two requests, so the check helps the user but does not guarantee uniqueness. `POST /api/products` stays as a safety net: it still creates the product and reports `duplicate: true`, which this UI does not use.
- A failure of the pre-check (error, `429`, malformed response) stops the submit with the generic error; the product is not created.
- Category and status are limited to the values of the API: `skincare | makeup` and `new | used | finished`.
- The server is the one that decides: the inline validation only saves a round trip.

## Data

Reads and writes `products` only through the API (the frontend never talks to Supabase). See [Product creation](product-create.md) and [Product list](product-list.md) for the columns and constraints. The request logic is in [`src/lib/productsApi.ts`](../../src/lib/productsApi.ts) (`findDuplicate`, `createProduct`, `addProduct`; query key `['products']`).

## Security and access

- Reached only through `ProtectedRoute`; the API enforces the session, ownership and RLS (see [Product creation](product-create.md)).
- A `blocked` user gets `403` from the API; the UI shows the generic error.
- The caller's id is never sent: the API takes it from the session.
- User text is rendered as text by React, including in the duplicate alert.

## Tests

- Unit tests:
  - [`src/pages/HomePage/HomePage.test.tsx`](../../src/pages/HomePage/HomePage.test.tsx)
  - [`src/pages/HomePage/components/AddProductDrawer/AddProductDrawer.test.tsx`](../../src/pages/HomePage/components/AddProductDrawer/AddProductDrawer.test.tsx)
  - [`src/lib/productsApi.test.ts`](../../src/lib/productsApi.test.ts)
  - [`src/components/FormDrawer/FormDrawer.test.tsx`](../../src/components/FormDrawer/FormDrawer.test.tsx)
  - [`src/components/Drawer/Drawer.test.tsx`](../../src/components/Drawer/Drawer.test.tsx)
  - [`src/pages/HomePage/components/EmptyState/EmptyState.test.tsx`](../../src/pages/HomePage/components/EmptyState/EmptyState.test.tsx)
- E2E tests: [`e2e/add-product.spec.ts`](../../e2e/add-product.spec.ts) (first product added from the empty state; an existing product is not created; Cancel closes the drawer without creating anything)

## Open decisions

- Dependency on [#155](https://github.com/Alessia-C/Careme/issues/155): the `name` and `brand` filters of `GET /api/products` are not implemented yet. Until it is in `staging`, the pre-check never finds a duplicate, because the client requires the first product returned to match exactly, so the duplicate state cannot be reached against the real API and creation always goes through.
- Acceptance criteria of #66 that the design does not cover: the "add anyway" and "go update the existing one" options for a duplicate, and the "add another" option after success. They are not implemented; the product owner needs to confirm this.
- The product list does not exist yet (MK-031): the criterion "the product list reflects the new entry" is met only through the `['products']` invalidation, which has no list to refresh for now.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-01 | Initial implementation | TBD |
