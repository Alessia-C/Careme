# Product list

Lets a logged-in user read their own products, newest first, and narrow them down by text and category. The list is paginated and leaves out the note, which is only shown in the [product detail](product-detail.md).

|               |                                                                |
| ------------- | -------------------------------------------------------------- |
| **Status**    | In progress                                                    |
| **Issue**     | [#63](https://github.com/Alessia-C/Careme/issues/63)           |
| **Users**     | Logged-in user                                                 |
| **Pages**     | None yet (backend only; the list page comes with the UI issue) |
| **Endpoints** | [`GET /api/products`](../api/products-list.md)                 |

## Behavior

The client calls `GET /api/products` with optional `search`, `category`, `limit` and `offset`. The API answers `200` with `products` (one page) and `total` (all the matches). No match, or a page past the end, is `200` with an empty list. There is no UI yet, so empty, loading and error states are not defined.

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

Reads `products` ([migration](../../supabase/migrations/20260926094137_create_products.sql)). The index `products_user_id_created_at_idx` on `(user_id, created_at desc)` serves the list ([migration](../../supabase/migrations/20261101120000_add_products_user_created_index.sql)). The text search cannot use it and scans only the rows of the user.

## Security and access

- Runs as the caller, so the RLS select policy applies (`auth.uid() = user_id` and an `active` profile), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well: the API is the first line of defense, RLS the last.
- A `blocked` user gets `403` from `withAuth`.
- Nothing is written.

## Tests

- Unit tests: [`api/products/_routes/list.test.ts`](../../api/products/_routes/list.test.ts), [`shared/products.test.ts`](../../shared/products.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- E2E tests: None (no UI yet)

## Open decisions

- Whether the UI paginates with pages or "load more", and which page size it uses (decided with the frontend issue).

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-01 | Initial implementation | TBD |
