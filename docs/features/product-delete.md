# Product delete

Lets a logged-in user permanently delete one of their own products.

|               |                                                                |
| ------------- | -------------------------------------------------------------- |
| **Status**    | In progress                                                    |
| **Issue**     | [#65](https://github.com/Alessia-C/Careme/issues/65)           |
| **Users**     | Logged-in user                                                 |
| **Pages**     | None yet (backend only; the UI comes with a separate FE issue) |
| **Endpoints** | [`DELETE /api/products/:id`](../api/products-delete.md)        |

## Behavior

Backend `DELETE /api/products/:id`. The client calls it with the product id. The API answers `204` with no body when the product was deleted, or `404` when it cannot be deleted. There is no UI yet, so empty, loading, error and confirmation states are not defined.

## Business rules

- The deletion is permanent: there is no soft delete and no undo.
- A user can only delete their own products.
- The success answer is `204 No Content`, without a body.
- The `404` is the same for a missing product, a product of another user and an id that is not a uuid, so the answer never tells whether an id exists for someone else.
- A malformed id is answered without calling the database.
- A second `DELETE` on the same id answers `404`, because the product no longer exists.

## Data

Deletes one row of `products` by `id` ([migration](../../supabase/migrations/20260926094137_create_products.sql)). Nothing else is written: no other table references `products`.

## Security and access

- Runs as the caller, so the RLS delete policy applies (`auth.uid() = user_id` and an `active` profile), see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql). The query filters `user_id` as well. There is no admin bypass.
- A `blocked` user gets `403` from `withAuth`.
- Without a session the answer is `401`.

## Tests

- Unit tests: [`api/products/_routes/remove.test.ts`](../../api/products/_routes/remove.test.ts), [`shared/products.test.ts`](../../shared/products.test.ts)
- Wiring over HTTP: [`api/products/_app.test.ts`](../../api/products/_app.test.ts)
- E2E tests: None (no UI yet)

## Open decisions

- None

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-01 | Initial implementation | TBD |
