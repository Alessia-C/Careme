# Product creation

Lets a logged-in user add a product (name, brand, category, status, optional note) to their own list. The API tells the client when the user already has a product with the same name and brand, the product is created anyway. The UI ([Add product](add-product.md)) does not rely on this flag: it checks for a duplicate before sending the request.

|               |                                                      |
| ------------- | ---------------------------------------------------- |
| **Status**    | In progress                                          |
| **Issue**     | [#62](https://github.com/Alessia-C/Careme/issues/62) |
| **Users**     | Logged-in user                                       |
| **Pages**     | `/` through the [Add product](add-product.md) drawer |
| **Endpoints** | [`POST /api/products`](../api/products-create.md)    |

## Behavior

The client sends `name`, `brand`, `category`, `status` and optionally `note`. The API answers `201` with the created product, `duplicate` and `duplicateOf`. The UI is the "Add Product" drawer described in [Add product](add-product.md): it first looks for a duplicate with `GET /api/products?name=&brand=&limit=1` and calls `POST` only if none is found, so in practice the user never sees `duplicate: true`. The `POST` duplicate flag stays as a safety net (the check and the creation are not atomic). Loading and error states belong to the drawer.

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
- UI tests: see [Add product](add-product.md#tests), including [`e2e/add-product.spec.ts`](../../e2e/add-product.spec.ts)

## Open decisions

- None. The UI does not ask for confirmation on `duplicate: true`: it blocks a duplicate with the pre-check. The pre-check depends on the `name` and `brand` filters of [#155](https://github.com/Alessia-C/Careme/issues/155), see [Add product](add-product.md#open-decisions).

## Changelog

| Date       | Change                                                                                       | PR  |
| ---------- | -------------------------------------------------------------------------------------------- | --- |
| 2026-11-01 | Initial implementation                                                                       | TBD |
| 2026-11-01 | UI added: drawer with duplicate pre-check, `duplicate: true` is no longer used by the client | TBD |
