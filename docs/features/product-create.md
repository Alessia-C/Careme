# Product creation

Lets a logged-in user add a product (name, brand, category, status, optional note) to their own list. The API tells the client when the user already has a product with the same name and brand, so the UI can ask for confirmation; the product is created anyway.

|               |                                                                    |
| ------------- | ------------------------------------------------------------------ |
| **Status**    | In progress                                                        |
| **Issue**     | [#62](https://github.com/Alessia-C/Careme/issues/62)               |
| **Users**     | Logged-in user                                                     |
| **Pages**     | None yet (backend only; the creation form comes with the UI issue) |
| **Endpoints** | [`POST /api/products`](../api/products-create.md)                  |

## Behavior

The client sends `name`, `brand`, `category`, `status` and optionally `note`. The API answers `201` with the created product, `duplicate` and `duplicateOf`. There is no UI yet, so empty, loading and error states are not defined.

## Business rules

- A product always belongs to the authenticated user; the owner is never taken from the request.
- `name` and `brand` are required, 1–100 characters after trimming. `note` is optional, up to 500 characters; a missing, `null` or blank note is saved as `null`.
- `category` is `skincare` or `makeup`; `status` is `new`, `used` or `finished`. `status` is required even though the column has a default.
- A product with the same `name` and `brand` as one the user already has is still created. The response sets `duplicate: true` and `duplicateOf` to the existing product's id.
- The duplicate match is exact on the trimmed values and case sensitive (`CeraVe` and `cerave` differ).
- The duplicate check is informative and not atomic: two simultaneous requests can both report `duplicate: false`.

## Data

Writes one row to `products` ([migration](../../supabase/migrations/20260926094137_create_products.sql)): `user_id`, `name`, `brand`, `category`, `status`, `note`; `id` and `created_at` come from the database. Reads `products` to look for the duplicate. No unique constraint on `(user_id, name, brand)`, by design. The length limits are also `check` constraints ([migration](../../supabase/migrations/20261101090000_add_products_text_checks.sql)).

## Security and access

- Runs as the caller, so the RLS insert policy applies (`auth.uid() = user_id` and an `active` profile), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql).
- Only whitelisted fields are inserted: `id`, `user_id` and `created_at` in the body are ignored.
- A `blocked` user gets `403` from `withAuth`, and RLS would refuse the insert anyway.
- Requires `Content-Type: application/json` (CSRF defence).

## Tests

- Unit tests: [`api/products/_routes/create.test.ts`](../../api/products/_routes/create.test.ts), [`shared/products.test.ts`](../../shared/products.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- E2E tests: None (no UI yet)

## Open decisions

- Whether the UI asks for confirmation on `duplicate: true` and what the user can do then (decided with the frontend issue).

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-01 | Initial implementation | TBD |
