# Logout

Lets a logged-in user end their session from the header of any protected page. The session is revoked on the server, the session cookie is deleted and every other tab of the same browser leaves the app too.

|               |                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                              |
| **Issue**     | [#59](https://github.com/Alessia-C/Careme/issues/59)                                     |
| **Users**     | Logged-in user                                                                           |
| **Pages**     | Header of every protected page, `/` today (see [`src/router.tsx`](../../src/router.tsx)) |
| **Endpoints** | [`POST /api/auth/logout`](../api/auth-logout.md)                                         |

## Behavior

1. The user clicks "Logout" in [`AppHeader`](../../src/routes/AppHeader.tsx) (see [App layout](app-layout.md)).
2. The button is disabled while the request is in progress, so it cannot be sent twice. There is no other loading text.
3. The app sends `POST /api/auth/logout` with no body. The browser attaches the HttpOnly session cookie by itself.
4. When the request ends, whatever the outcome (success, `401`, other error, network failure), the app:
   - empties the in-memory auth store (user and role);
   - clears the whole React Query cache, so the next user never sees cached data;
   - navigates to `/login` with the history entry replaced, so Back does not return to the protected page;
   - sends the message `logout` to the other tabs.
5. No error message is shown: the user always lands on `/login`.
6. Other tabs of the same browser: [`useLogoutSync`](../../src/hooks/useLogoutSync.ts), mounted in `AppLayout`, listens on the `BroadcastChannel` named `careme-auth`. When it receives `logout` it does the same cleanup as step 4 (store, cache, redirect to `/login` with replace) and does not call the API again. The message carries no data and a tab never receives its own message.

## Business rules

- The client treats `200` and `401` as a successful logout (`401` means the session was already over). Any other status or a network error is a failure, but the local session is dropped anyway: the user asked to leave, and the device may be shared.
- A failed request can leave the server session alive until the token expires. This is accepted so the user is never stuck in the app.
- Only the current session is revoked, not the user's sessions on other devices (the API uses scope `local`).
- Tab synchronization is best effort: where `BroadcastChannel` does not exist nothing happens, and the other tabs find out on their next request. It works only inside one browser profile, not across browsers or devices.
- Restoring the session after a page reload is out of scope (separate issue): the auth store is in memory only.

## Data

None. The feature reads and writes no table. The API revokes the session in Supabase Auth and deletes the cookie `__Host-sb-access-token` (`sb-access-token` under `vercel dev`) by sending it again with `Max-Age=0`; see [`docs/api/auth-logout.md`](../api/auth-logout.md). The frontend goes through `logout()` in [`src/lib/authApi.ts`](../../src/lib/authApi.ts), which never throws and returns `{ ok: true }` or `{ ok: false, reason: 'failed' }`.

## Security and access

- Only reachable from protected pages (behind `ProtectedRoute`); the API itself accepts the token from the header or from the cookie.
- A `blocked` user can still log out: the endpoint does not use `withAuth`, so they can revoke their session.
- The cookie is deleted by the server because it is HttpOnly and scripts cannot touch it. It is deleted on `200` and on both `401` responses, not on `429` and `500` (the session is still alive, a retry is possible).
- Clearing the React Query cache and the store on logout avoids leaking one user's data to the next user of the same device.
- The broadcast message contains no token or user data.
- Nothing is writable from this feature.

## Tests

- Unit tests:
  - [`api/auth/logout.test.ts`](../../api/auth/logout.test.ts): token from header or cookie (header wins), `Set-Cookie` deletion on `200` and on the `401` cases, no cookie deletion on `429` and `500`.
  - [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts): `getAccessToken` (header, cookie, priority, empty cookie) and `buildClearedSessionCookie`.
  - [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts): `logout()` status mapping.
  - [`src/routes/AppHeader.test.tsx`](../../src/routes/AppHeader.test.tsx): API call, store emptied, redirect to `/login`, cache cleared, other tabs notified, button disabled while in flight.
  - [`src/routes/AppLayout.test.tsx`](../../src/routes/AppLayout.test.tsx): skip link and Logout in the layout (existing tests only; it does not assert the tab synchronization, which is covered by `useLogoutSync.test.tsx`).
  - [`src/hooks/useLogoutSync.test.tsx`](../../src/hooks/useLogoutSync.test.tsx): session ended on a `logout` message, other messages ignored, channel closed on unmount, no effect without `BroadcastChannel`.
- E2E tests: [`e2e/logout.spec.ts`](../../e2e/logout.spec.ts): logout leads to `/login` and Back does not reopen the app; logout in one tab logs out a second tab. Not run yet (Playwright browsers are not installed locally).

## Open decisions

- Whether to tell the user when the logout request failed (today the failure is silent and the server session may stay alive until expiry). Not decided in the code; the user decides.
- The "blocked user can still log out" rule has no dedicated test in `api/auth/logout.test.ts`: it follows from the endpoint not using `withAuth`. Whether to add one is for the user to decide.
- Session restore after a page reload and handling of `401` from other endpoints: separate issue.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-10-25 | Initial implementation | TBD |
