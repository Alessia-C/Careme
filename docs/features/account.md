# Account

Lets a logged-in user read their own profile data and change their first and last name. Only the backend exists: the account page will be built in a separate issue. The password is changed through a separate feature, see [Change password](change-password.md).

|               |                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                                 |
| **Issue**     | [#73](https://github.com/Alessia-C/Careme/issues/73)                                        |
| **Users**     | Logged-in user                                                                              |
| **Pages**     | None yet                                                                                    |
| **Endpoints** | [`GET /api/account`](../api/account-get.md), [`PUT /api/account`](../api/account-update.md) |

## Behavior

1. `GET /api/account` answers `200` with `first_name`, `last_name` and `email`. A missing name is returned as an empty string.
2. `PUT /api/account` takes `first_name` and `last_name`, saves them and answers `200` with the saved names and the email.
3. An invalid body gets `400` with a message and nothing is saved. Loading, empty and error states of the page are not defined yet.

## Business rules

- A user can read and change only their own profile: the id comes from the session, never from the request.
- The email is read-only.
- Both names are required on every update, 1–50 characters after trimming, without NUL characters. The same limit applies at [signup](signup.md).
- A body with any other field (`email`, `role`, `status`, `id`, …) is refused instead of ignored.
- Changing the names updates `profiles` only: the signup metadata kept by Supabase Auth does not change.

## Data

Reads and writes the caller's row of `profiles` ([migration](../../supabase/migrations/20260926093507_create_profiles.sql)): `first_name`, `last_name`. The email comes from the Supabase Auth session. The name limits are also `check` constraints ([migration](../../supabase/migrations/20261125090000_add_profiles_name_checks.sql)).

## Security and access

- Runs as the caller, so the RLS policies "Users can view own profile" and "Users can update own profile" apply, both requiring an `active` profile, see [`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql).
- A `blocked` user gets `403` from `withAuth`.
- `role` and `status` are never written here, and the `prevent_privilege_change` trigger blocks non-admins in the database.
- The update requires `Content-Type: application/json` (CSRF defence), and the responses are not cacheable.

## Tests

- Unit tests: [`api/account/_routes/get.test.ts`](../../api/account/_routes/get.test.ts), [`api/account/_routes/update.test.ts`](../../api/account/_routes/update.test.ts), [`api/account/_validation.test.ts`](../../api/account/_validation.test.ts)
- Wiring over HTTP: [`api/account/_app.test.ts`](../../api/account/_app.test.ts)
- E2E tests: None (no UI yet)

## Open decisions

- Whether names may hold control or text direction characters, which are accepted today. To be decided before admins can list users.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-26 | Initial implementation | TBD |
