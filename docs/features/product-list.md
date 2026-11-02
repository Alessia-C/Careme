# Product list

Lets a logged-in user see their own products on the home page, newest first, and narrow them down by text. The list is paginated with a "Load more" button and leaves out the note, which is only shown in the [product detail](product-detail.md).

|               |                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                                                             |
| **Issue**     | [#63](https://github.com/Alessia-C/Careme/issues/63) (API), [#67](https://github.com/Alessia-C/Careme/issues/67) (page) |
| **Users**     | Logged-in user                                                                                                          |
| **Pages**     | `/` (see [`src/router.tsx`](../../src/router.tsx))                                                                      |
| **Endpoints** | [`GET /api/products`](../api/products-list.md)                                                                          |

## Behavior

### The page

- `/` shows the title "Your products", an "Add product" button, the search field and the list. The title, the button and the search appear after the first load; until then (loading) and in the first access state the page has no `h1`: the design has no title there, and the state's own heading (an `h2`) and the `<title>` identify the page. The document `<title>` is always "Your products – Careme".
- The list is a grid of cards: 1 column below 768px (mobile), 2 columns from 768px (tablet), 3 columns from 1024px (desktop). Each card shows the name, the category (Skincare or Makeup), a status badge (New, Used or Finished), the brand and two buttons, both `Button` with `size="large"` and `fullWidth` (as the "Load more" button and the state actions). The badge text is darker than in the Figma design so it reaches the 4.5:1 contrast of WCAG AA; the backgrounds are the design ones.
- "Detail" only records which product was chosen (`selectedProductId`); the detail drawer is a later issue (see Open decisions).
- "Delete" is only the call to action of the design: it is disabled until deleting a product has its own issue.
- The user text (name, brand) is rendered as text by React.

### Pagination

- The page loads 12 products (a multiple of the 2 and 3 columns, so the last row is full; the API maximum is 20) with `useInfiniteQuery`.
- "Load more" appears while there are more products than the ones shown and adds the next 12 below. While it runs the button reads "Loading…" and is `aria-disabled` (not `disabled`, so it keeps the focus).
- A product created between two "Load more" can come in two pages: the list shows it once.
- If "Load more" fails, the products already shown stay and an error "We couldn’t load more products" appears above the button, which can be pressed again.

### Search

> The search field is shown **disabled** for now: the search has its own issue. The behavior below is implemented in `ProductSearch` and `useProducts`, and is turned on by that issue.

- The search field (placeholder "Search by name or brand") is applied when the user presses Enter, on the product name and brand. The term is trimmed first.
- Clearing the field restores the full list without pressing Enter.
- While a new search loads, the previous list stays on screen (no loader, the field keeps the focus).
- Before sending, the client rejects what the API would reject, with an inline error under the field and no request: a term with `%`, `_`, `\`, `*`, `"`, `,`, `(`, `)` or a NUL character shows "Search contains invalid characters"; a term longer than 100 characters shows "Search is too long (max 100 characters)". Typing again dismisses the error.

### States

The page picks one view from the request state (`getProductListView` in [`src/lib/productListView.ts`](../../src/lib/productListView.ts), called by `HomePage`): loading, error, first access, no results or the list. The first four are rendered by `ProductsEmptyState`, which maps each one to a `ContentState` with its title, text and action; the list, with "Load more" and its error, is rendered by `ProductListSection`.

- Loading (first load): a `ContentState` with a loader and the text "Loading products…" (separate from the loader shown while the session is restored).
- Error: a `ContentState` with a red alert "We couldn’t load your products" with "Please check your connection and try again." and a "Try again" button that repeats the request. The request is retried once automatically before the error is shown; a `401` is not retried (see [Session expiry](session-expiry.md)).
- First access (no products and no search): the `ContentState` "Add your product" with an "Add product" button, as described in [Add product](add-product.md).
- No results (a search with no matches): the `ContentState` "No product found" with the text "Try a different name or brand".
- A visually hidden `role="status"` region (`VisuallyHiddenStatus`) is always in the page, and only its text changes, because many screen readers do not announce a region that appears already filled. The text comes from `getProductListAnnouncement` (same file): "Loading products…" while a new search loads, "Showing N of M products" when the list is shown (after a search or a "Load more"), "No product found" in the no results state. It is empty while loading, on error and on first access: the `ContentState` of those views announces itself.
- No polling: the list is never read again by time, on window focus or on reconnect. It refreshes only when a product is added, on "Try again" and on a new search.
- After a product is added, the `['products']` queries are invalidated and the list refreshes (see [Add product](add-product.md)).

### API contract

The client calls `GET /api/products` with `search` (only if not empty), `limit` and `offset`; it does not send `category`. The API answers `200` with `products` (one page) and `total` (all the matches). No match, or a page past the end, is `200` with an empty list. A body that is not a page is treated as an error.

## Business rules

- A user only sees their own products; the owner filter never comes from the request.
- Sorted by creation date, newest first; the id breaks the ties so pages stay stable.
- Page size: `limit` from 1 to 20, default 10; `offset` default 0. Out-of-range or non-numeric values are rejected with `400`, not corrected.
- `search` finds the text inside the `name` (case insensitive) or inside the `brand` (case sensitive). A blank search means no search.
- `search` cannot contain `%`, `_`, `\`, `*`, `"`, `,`, `(`, `)` or a NUL character: it is rejected with `400`.
- `category` is `skincare`, `makeup` or `all`; `all` and a missing value mean no filter.
- `total` counts the products that match `search` and `category`, not only the page.
- Each item has `id`, `name`, `brand`, `category`, `status` and `created_at`, without the `note`.

## Data

The page keeps the pages in the React Query cache under `['products', 'list', <search>]` ([`useProducts`](../../src/hooks/useProducts/useProducts.ts)). Reads `products` ([migration](../../supabase/migrations/20260926094137_create_products.sql)). The index `products_user_id_created_at_idx` on `(user_id, created_at desc)` serves the list ([migration](../../supabase/migrations/20261101120000_add_products_user_created_index.sql)). The text search cannot use it and scans only the rows of the user.

## Security and access

- Runs as the caller, so the RLS select policy applies (`auth.uid() = user_id` and an `active` profile), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well: the API is the first line of defense, RLS the last.
- A `blocked` user gets `403` from `withAuth`.
- Nothing is written.

## Tests

- Unit tests (API): [`api/products/_routes/list.test.ts`](../../api/products/_routes/list.test.ts), [`shared/products.test.ts`](../../shared/products.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- Unit tests (UI):
  - [`src/pages/HomePage/HomePage.test.tsx`](../../src/pages/HomePage/HomePage.test.tsx)
  - [`src/hooks/useProducts/useProducts.test.tsx`](../../src/hooks/useProducts/useProducts.test.tsx)
  - [`src/lib/productsApi.test.ts`](../../src/lib/productsApi.test.ts)
  - [`src/lib/productSearch.test.ts`](../../src/lib/productSearch.test.ts)
  - [`src/lib/productListView.test.ts`](../../src/lib/productListView.test.ts)
  - [`src/pages/HomePage/components/ProductCard/ProductCard.test.tsx`](../../src/pages/HomePage/components/ProductCard/ProductCard.test.tsx)
  - [`src/pages/HomePage/components/ProductList/ProductList.test.tsx`](../../src/pages/HomePage/components/ProductList/ProductList.test.tsx)
  - [`src/pages/HomePage/components/ProductListSection/ProductListSection.test.tsx`](../../src/pages/HomePage/components/ProductListSection/ProductListSection.test.tsx)
  - [`src/pages/HomePage/components/ProductsEmptyState/ProductsEmptyState.test.tsx`](../../src/pages/HomePage/components/ProductsEmptyState/ProductsEmptyState.test.tsx)
  - [`src/pages/HomePage/components/ProductSearch/ProductSearch.test.tsx`](../../src/pages/HomePage/components/ProductSearch/ProductSearch.test.tsx)
  - [`src/components/SearchInput/SearchInput.test.tsx`](../../src/components/SearchInput/SearchInput.test.tsx)
  - [`src/components/VisuallyHiddenStatus/VisuallyHiddenStatus.test.tsx`](../../src/components/VisuallyHiddenStatus/VisuallyHiddenStatus.test.tsx)
  - [`src/components/Button/Button.test.tsx`](../../src/components/Button/Button.test.tsx) (`size="large"` and `fullWidth`)
  - [`src/components/ContentState/ContentState.test.tsx`](../../src/components/ContentState/ContentState.test.tsx)
  - [`src/components/PageHeader/PageHeader.test.tsx`](../../src/components/PageHeader/PageHeader.test.tsx)
- E2E tests: [`e2e/products-list.spec.ts`](../../e2e/products-list.spec.ts) (list, disabled search field, Load more, retry after an error)

## Open decisions

- Category filter: the API supports `category`, but the page has no filter (All, Skincare, Makeup, Reset Filter). It is out of scope for #67 and postponed.
- Detail: the "Detail" button only sets `selectedProductId`; the detail drawer comes with a later issue.
- Delete: the "Delete" button is disabled; it comes with a later issue.
- The Figma frame of the "No product found" state has the first-access text "Start by adding your first product to manage your catalog", which does not fit a search without results. The page uses "Try a different name or brand" instead; the design needs to confirm it.
- Badge colors: the Figma colors of the status badges do not reach the 4.5:1 contrast at 12px, so the text is darker. "Used" and "Finished" colors are not in the design; the page uses the gray and primary variants of its badges. The design needs to confirm them.
- Search: the field is disabled until the search issue. The search tests of the page and of the E2E spec come back with it.
- The Figma "Filter" component (search and category badges, three layouts) is for the postponed category filter.

## Changelog

| Date       | Change                                                                               | PR  |
| ---------- | ------------------------------------------------------------------------------------ | --- |
| 2026-11-01 | Initial implementation                                                               | TBD |
| 2026-11-01 | Home page list: cards, "Load more", search, states                                   | TBD |
| 2026-11-02 | Accessibility: badge contrast, search error and results announced, "Delete" disabled | TBD |
| 2026-11-02 | Page `<title>`, always-present status region, view logic moved to `src/lib`          | TBD |
