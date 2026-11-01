# Product detail

Lets a logged-in user read one of their own products with all its fields, including the note that the [product list](product-list.md) leaves out.

|               |                                                                  |
| ------------- | ---------------------------------------------------------------- |
| **Status**    | In progress                                                      |
| **Issue**     | [#63](https://github.com/Alessia-C/Careme/issues/63)             |
| **Users**     | Logged-in user                                                   |
| **Pages**     | None yet (backend only; the detail page comes with the UI issue) |
| **Endpoints** | [`GET /api/products/:id`](../api/products-detail.md)             |

## Behavior

The client calls `GET /api/products/:id`. The API answers `200` with the `product`, or `404` when it cannot be shown. There is no UI yet, so empty, loading and error states are not defined.

## Business rules

- A user can only read their own products.
- The `404` is the same for a missing product, a product of another user and an id that is not a uuid, so the answer never tells whether an id exists for someone else.
- A malformed id is answered without calling the database.
- The product has `id`, `name`, `brand`, `category`, `status`, `note` (`null` when there is none) and `created_at`.

## Data

Reads one row of `products` by `id` ([migration](../../supabase/migrations/20260926094137_create_products.sql)); the primary key index serves the lookup.

## Security and access

- Runs as the caller, so the RLS select policy applies (`auth.uid() = user_id` and an `active` profile), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well.
- A `blocked` user gets `403` from `withAuth`.
- Nothing is written.

## Tests

- Unit tests: [`api/products/_routes/detail.test.ts`](../../api/products/_routes/detail.test.ts), [`shared/products.test.ts`](../../shared/products.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- E2E tests: None (no UI yet)

## Open decisions

- None

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-01 | Initial implementation | TBD |
