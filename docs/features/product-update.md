# Product update

Lets a logged-in user edit one of their own products by sending the whole product again.

|               |                                                                |
| ------------- | -------------------------------------------------------------- |
| **Status**    | In progress                                                    |
| **Issue**     | [#64](https://github.com/Alessia-C/Careme/issues/64)           |
| **Users**     | Logged-in user                                                 |
| **Pages**     | None yet (backend only; the edit form comes with the UI issue) |
| **Endpoints** | [`PUT /api/products/:id`](../api/products-update.md)           |

## Behavior

Backend `PUT /api/products/:id`. The client sends the whole product (`name`, `brand`, `category`, `status` and optionally `note`), not only what changed. The API answers `200` with the updated `product`, `400` when the body is not valid, or `404` when the product cannot be updated. There is no UI yet, so empty, loading and error states are not defined.

## Business rules

- A user can only update their own products, and the owner never changes.
- The body is validated like [product creation](product-create.md): `name` and `brand` are required (1-100 characters after trimming), `category` is `skincare` or `makeup`, `status` is `new`, `used` or `finished`, `note` is optional (up to 500 characters after trimming).
- `name`, `brand` and `note` are trimmed before they are saved. A missing, `null` or blank `note` clears the old note.
- A NUL character in a text field is rejected with `400`.
- Any other field in the body (`id`, `user_id`, `created_at`, ...) is ignored: only the five product fields are written.
- The `404` is the same for a missing product, a product of another user and an id that is not a uuid, so the answer never tells whether an id exists for someone else.
- The id is checked before the body: a malformed id is a `404` even if the body is also invalid, and without calling the database.
- Sending the current values again is not an error: the answer is `200`.
- There is no duplicate check: unlike creation, the response has no `duplicate` fields and a name and brand equal to another product are accepted.
- The product in the response has `id`, `name`, `brand`, `category`, `status`, `note` (`null` when there is none) and `created_at`. There is no `updated_at` column.

## Data

Updates one row of `products` by `id` ([migration](../../supabase/migrations/20260926094137_create_products.sql)): `name`, `brand`, `category`, `status` and `note`. `products.category` is `skincare | makeup` and `products.status` is `new | used | finished`.

## Security and access

- Runs as the caller, so the RLS update policy applies (`using`: `auth.uid() = user_id` and an `active` profile; `with check`: `auth.uid() = user_id`), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well.
- A `blocked` user gets `403` from `withAuth`.
- Without a session the answer is `401`.
- `id` and `user_id` are never taken from the body, so a product cannot change owner.

## Tests

- Unit tests: [`api/products/_routes/update.test.ts`](../../api/products/_routes/update.test.ts), [`api/products/_validation.test.ts`](../../api/products/_validation.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- E2E tests: None (no UI yet)

## Open decisions

- None

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-01 | Initial implementation | TBD |
