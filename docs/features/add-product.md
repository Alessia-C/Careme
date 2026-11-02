# Add product

Lets a logged-in user add a product (name, brand, category, status, optional note) from a drawer opened on the home page.

|               |                                                      |
| ------------- | ---------------------------------------------------- |
| **Status**    | In progress                                          |
| **Issue**     | [#66](https://github.com/Alessia-C/Careme/issues/66) |
| **Users**     | Logged-in user                                       |
| **Pages**     | `/` (see [`src/router.tsx`](../../src/router.tsx))   |
| **Endpoints** | [`POST /api/products`](../api/products-create.md)    |

## Behavior

### The page

- `/` shows the title "Your products" and the [product list](product-list.md). When the user has no products and is not searching, it shows the first-access empty state instead: an `ContentState` with a plus icon, the title "Add your product", the text "Start by adding your first product to manage your catalog" and an "Add product" button.
- The button opens the "Add Product" drawer, a side panel built on the native `<dialog>`: `AddProductDrawer` provides the fields and the submit logic, `FormDrawer` the structure shared by form drawers (title, scrolling fields, messages, and the submit and Cancel buttons).
- After a successful creation the drawer closes and the list refreshes, so the new product appears (the first one replaces the empty state).

### The drawer

- Layout on desktop (768px and wider): a panel 586px wide on the right, from under the 64px header to the bottom of the screen, with a rounded top-left and bottom-left corner. The overlay also starts under the header, so the header is not dimmed. The panel slides in from the right in 250ms and slides out the same way; with `prefers-reduced-motion: reduce` there is no animation. Browsers without `@starting-style` support open and close it without animation.
- Layout on phones (below 768px): the panel takes the whole width under the header, flat, on the light grey page background, with a larger title and no close (X) button and no divider under the title. The fields are 16px apart. The buttons stack: "Add Product" fills the width and Cancel, with the same outline look as on desktop, is under it. The buttons follow the fields instead of sitting at the bottom.
- Fields:
  - Name\* (text, required, up to 100 characters, placeholder "Enter product name").
  - Brand\* (text, required, up to 100 characters, placeholder "Enter brand name").
  - Category\* (select: Makeup, Skincare). Default: Makeup.
  - Status\* (select: New, Used, Finished). Default: New.
  - Note (textarea, optional, up to 500 characters, placeholder "Enter notes…").
- The two selects always hold a valid value, so the form can never be sent with an empty category or status.
- Validation is inline, next to each field, on the same rules as the API ([`shared/products.ts`](../../shared/products.ts)): a blank Name shows "Name is required", a blank Brand shows "Brand is required", a Note longer than 500 characters shows "Note must be at most 500 characters". The "Add Product" button is disabled while the form is invalid.
- The form always starts empty with the defaults: the page remounts the drawer every time it opens, so nothing typed before is shown again.

### Submitting

1. The button changes to "Adding…" and is disabled while the request runs.
2. The app sends `POST /api/products`.
3. On success the `['products']` queries are invalidated, which refreshes the list, and the drawer closes.

- The caller's id is never sent: the API takes it from the session.
- If the user already has a product with the same name and brand it is created anyway: the response says `duplicate: true`, which this UI does not use yet (see Open decisions).

### Errors

- Server or network error: a red alert "Something went wrong" with "We couldn’t add the product. Please try again." The typed values are kept and the user can press the button again.
- `429`: the same alert with "Too many attempts. Please wait a moment and try again."
- `401`: the user is sent to `/login` (see [Session expiry](session-expiry.md)).
- A new attempt clears the previous alert.

### Closing

- Cancel, the close (X) button, `Esc` and a click on the backdrop close the drawer. Nothing is created and the typed values are discarded. The focus goes back to the "Add product" button.
- On phones the X is hidden: Cancel and `Esc` close the drawer, and the panel covers the whole page, so there is no backdrop to click.
- While the drawer is open the rest of the page, header included, cannot be used (modal dialog).

## Business rules

- A product always belongs to the logged-in user; the API takes the owner from the session.
- Category and status are limited to the values of the API: `skincare | makeup` and `new | used | finished`.
- The server is the one that decides: the inline validation only saves a round trip.
- Nothing is checked about duplicates in this version: a product with the same name and brand as an existing one is created.

## Data

Reads and writes `products` only through the API (the frontend never talks to Supabase). See [Product creation](product-create.md) and [Product list](product-list.md) for the columns and constraints. The request logic is in [`src/lib/productsApi.ts`](../../src/lib/productsApi.ts) (`createProduct`; query key `['products']`).

## Security and access

- Reached only through `ProtectedRoute`; the API enforces the session, ownership and RLS (see [Product creation](product-create.md)).
- A `blocked` user gets `403` from the API; the UI shows the generic error.
- The caller's id is never sent: the API takes it from the session.
- User text is rendered as text by React.

## Tests

- Unit tests:
  - [`src/pages/HomePage/HomePage.test.tsx`](../../src/pages/HomePage/HomePage.test.tsx)
  - [`src/pages/HomePage/components/AddProductDrawer/AddProductDrawer.test.tsx`](../../src/pages/HomePage/components/AddProductDrawer/AddProductDrawer.test.tsx)
  - [`src/lib/productsApi.test.ts`](../../src/lib/productsApi.test.ts)
  - [`src/components/FormDrawer/FormDrawer.test.tsx`](../../src/components/FormDrawer/FormDrawer.test.tsx)
  - [`src/components/Drawer/Drawer.test.tsx`](../../src/components/Drawer/Drawer.test.tsx)
  - [`src/components/ContentState/ContentState.test.tsx`](../../src/components/ContentState/ContentState.test.tsx)
- E2E tests: [`e2e/add-product.spec.ts`](../../e2e/add-product.spec.ts) (first product added from the empty state; Cancel closes the drawer without creating anything)

## Open decisions

- Duplicate blocking: the Figma frame `add-product-validation-errors` blocks a product with the same name and brand (red Name and Brand, a warning, "Add Product" disabled until one changes). It is not part of this story: it will be handled in a new linked issue, after [#155](https://github.com/Alessia-C/Careme/issues/155) adds the `name` and `brand` filters to `GET /api/products`. Until then `POST /api/products` creates the duplicate and flags it.
- Acceptance criteria of #66 that the design does not cover: the "add anyway" and "go update the existing one" options for a duplicate, and the "add another" option after success. They are not implemented; the product owner needs to confirm this.
- Category and Status on phones: the mobile design shows the placeholders "Select category" and "Select status", while the desktop design shows Makeup and New already selected. The implementation keeps the defaults on both; the design needs to confirm.

## Changelog

| Date       | Change                                        | PR  |
| ---------- | --------------------------------------------- | --- |
| 2026-11-01 | Initial implementation (drawer, phone layout) | TBD |
| 2026-11-01 | The list refreshes after a creation (#67)     | TBD |
