# Session restore

Keeps the user logged in across a page reload. The auth store lives in memory and is empty after a reload, while the session cookie may still be valid, so the app asks the API who the user is before showing anything.

|               |                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                                                                                   |
| **Issue**     | [#55](https://github.com/Alessia-C/Careme/issues/55)                                                                                          |
| **Users**     | Logged-in user, anonymous                                                                                                                     |
| **Pages**     | Every page: [`SessionRestore`](../../src/routes/SessionRestore.tsx) is the root of the route tree in [`src/router.tsx`](../../src/router.tsx) |
| **Endpoints** | [`GET /api/auth/me`](../api/auth-me.md)                                                                                                       |

## Behavior

1. On every page load (also `/login` and `/signup`) `SessionRestore` calls `GET /api/auth/me` through `fetchSession()` in [`src/lib/authApi.ts`](../../src/lib/authApi.ts), using React Query (`useQuery`, no retries). The browser sends the HttpOnly cookie by itself.
2. While it waits, the page shows only a `role="status"` "Loading…" message. Nothing else is rendered, so `ProtectedRoute` does not redirect a logged-in user to `/login`.
3. Outcome:
   - **`200`**: user and role go into the store and the requested page is rendered. A logged-in user opening `/login` or `/signup` is sent to `/`.
   - **`401` / `403`** (no cookie, expired or revoked session, blocked user): no session. Protected pages redirect to `/login?next=...` as usual, with no message and no `signedOut` state.
   - **Network error, `429`, `5xx` or malformed body**: the outcome is unknown. The app goes to `/login` (protected pages redirect there; on `/login` the form stays) and the login page shows an error `Feedback` (`role="alert"`): "We couldn't restore your session", "Check your connection and sign in again.". It stays until closed, can be closed with the close button and is shown once. `/signup` has no message.
4. The check runs once per page load. Logging in or out later does not repeat it: `restoreStatus` in the store ([`authStore`](../../src/stores/authStore.ts)) goes `pending` → `restored` (or `failed`, until the login page shows the warning) and never back to `pending`.

## Business rules

- The session is never read by scripts: the token stays in the HttpOnly cookie and `/api/auth/me` returns no token.
- The role comes from the database through `withAuth`; the UI uses it only as a hint, authorization is enforced by the API and RLS.
- A blocked user gets `403` and is treated as having no session.
- Login and logout cannot race with the check: the page renders nothing but the loading status until it ends.

## Data

None. It reads `profiles.role` through `withAuth`. Nothing is written.

## Security and access

- Public page; only the API call needs the cookie. See [`docs/api/auth-me.md`](../api/auth-me.md).
- The error message is generic and says nothing about the account.

## Tests

- [`api/auth/me.test.ts`](../../api/auth/me.test.ts): `405`, `401`, `403`, `200` with header and cookie, no token in the response.
- [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts): `withAuth` now passes `email`; `500` when the user has none.
- [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts): `fetchSession()` for `200`, `401`/`403`, `429`/`5xx`, invalid body, network error.
- [`src/stores/authStore.test.ts`](../../src/stores/authStore.test.ts): `restoreStatus` starts `pending` and survives `clearSession()`.
- [`src/routes/SessionRestore.test.tsx`](../../src/routes/SessionRestore.test.tsx): loading without redirect, session restored, one request only, redirect without message, `/login` redirects a logged-in user, error message on failure (protected page and `/login`), shown once.
- [`e2e/session-restore.spec.ts`](../../e2e/session-restore.spec.ts): reload keeps the session, `/login` redirects a logged-in user, logout then reload shows no message, no session leads to `/login`, server failure shows the error, no token in cookies or storage. The other E2E specs mock `/api/auth/me` through [`e2e/helpers.ts`](../../e2e/helpers.ts).

## Open decisions

- Refresh of the access token (it expires after 60 minutes) and handling of `401` from other endpoints: separate issues.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-10-26 | Initial implementation | TBD |
