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
2. The button is disabled while the request is in progress, so it cannot be sent twice. The header also has a visually hidden live region (`role="status"`, always in the DOM) that reads "Logging out…" while the request is in progress and is empty otherwise, so screen reader users hear that something is happening.
3. The app sends `POST /api/auth/logout` with the body `{}` and `Content-Type: application/json` (the API requires it as CSRF defence and ignores the content). The browser attaches the HttpOnly session cookie by itself.
4. When the request ends, whatever the outcome (success, `401`, other error, network failure), the app:
   - empties the in-memory auth store (user and role);
   - clears the whole React Query cache, so the next user never sees cached data;
   - navigates to `/login` with the history entry replaced, so Back does not return to the protected page, passing the navigation state `{ signedOut: true }` ([`src/lib/signedOut.ts`](../../src/lib/signedOut.ts));
   - sends the message `logout` to the other tabs.
5. No error message is shown for a failed request: the user always lands on `/login`.
6. Because the Logout button no longer exists on `/login`, the [login page](login.md) reads the `signedOut` state: it shows an info `Feedback` titled "You have been signed out" with the text "Sign in again to continue." and moves the keyboard focus to the `h1`, so keyboard and screen reader users do not start from `<body>`. On a normal visit to `/login` there is no message and the focus is not moved.
7. Other tabs of the same browser: [`useLogoutSync`](../../src/hooks/useLogoutSync.ts), mounted in `AppLayout`, listens through `listenForLogout()` in [`src/lib/logoutChannel.ts`](../../src/lib/logoutChannel.ts) on the `BroadcastChannel` named `careme-auth`. When it receives `logout` it runs the same cleanup as step 4 (store, cache, redirect to `/login` with replace and the `signedOut` state, so the signed-out message appears there too) through [`useEndSession`](../../src/hooks/useEndSession.ts), and does not call the API again. The sending tab uses `broadcastLogout()` from the same file. The message carries no data and a tab never receives its own message.

## Business rules

- The client treats `200` and `401` as a successful logout (`401` means the session was already over). Any other status or a network error is a failure, but the local session is dropped anyway: the user asked to leave, and the device may be shared.
- A failed request (for example `429` or `500`) can leave the token unrevoked on Supabase until it expires. This is accepted so the user is never stuck in the app; the API still deletes the cookie, so the token is no longer in the browser.
- Only the current session is revoked, not the user's sessions on other devices (the API uses scope `local`).
- Tab synchronization is best effort: where `BroadcastChannel` does not exist nothing happens, and the other tabs find out on their next request. It works only inside one browser profile, not across browsers or devices.
- Restoring the session after a page reload is out of scope (separate issue): the auth store is in memory only.

## Data

None. The feature reads and writes no table. The API revokes the session in Supabase Auth and deletes the cookie `__Host-sb-access-token` (`sb-access-token` under `vercel dev`) by sending it again with `Max-Age=0`; see [`docs/api/auth-logout.md`](../api/auth-logout.md). The frontend goes through `logout()` in [`src/lib/authApi.ts`](../../src/lib/authApi.ts), which never throws and returns `{ ok: true }` or `{ ok: false, reason: 'failed' }`.

## Security and access

- Only reachable from protected pages (behind `ProtectedRoute`); the API itself accepts the token from the header or from the cookie.
- A `blocked` user can still log out: the endpoint does not use `withAuth`, so they can revoke their session.
- The cookie is deleted by the server because it is HttpOnly and scripts cannot touch it. It is deleted on every outcome of the handler (`200`, `401`, `429`, `500`), because the client drops its local session anyway and a shared device must not keep a usable cookie. It is not sent on `405`, `415` and `400`, which are rejected before the handler. If both a Bearer header and the cookie arrive, the Bearer token is revoked and the cookie is deleted anyway.
- The endpoint requires `Content-Type: application/json` and an object body (CSRF defence: a cross-site form cannot send it without a CORS preflight). Wrong content type gives `415`, a missing or non-object body gives `400`.
- Clearing the React Query cache and the store on logout avoids leaking one user's data to the next user of the same device.
- The broadcast message contains no token or user data.
- Nothing is writable from this feature.

## Tests

- Unit tests:
  - [`api/auth/logout.test.ts`](../../api/auth/logout.test.ts): `405`, `415` and `400` (CSRF defence), token from header or cookie (header wins), `Set-Cookie` deletion on `200`, `401`, `429` and `500`, blocked user not checked (profile status is never read).
  - [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts): `getAccessToken` (header, cookie, priority, empty cookie) and `buildClearedSessionCookie`.
  - [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts): `logout()` status mapping and the JSON request.
  - [`src/lib/signedOut.test.ts`](../../src/lib/signedOut.test.ts): recognition of the `signedOut` navigation state.
  - [`src/pages/LoginPage/LoginPage.test.tsx`](../../src/pages/LoginPage/LoginPage.test.tsx) (block "after a logout"): signed-out message and focus on the heading; nothing on a normal visit.
  - [`src/routes/AppHeader.test.tsx`](../../src/routes/AppHeader.test.tsx): API call, store emptied, redirect to `/login`, cache cleared, other tabs notified, button disabled while in flight, empty status region until a logout is in progress, redirect with the `{ signedOut: true }` navigation state.
  - [`src/routes/AppLayout.test.tsx`](../../src/routes/AppLayout.test.tsx): skip link and Logout in the layout (existing tests only; it does not assert the tab synchronization, which is covered by `useLogoutSync.test.tsx`).
  - [`src/hooks/useLogoutSync.test.tsx`](../../src/hooks/useLogoutSync.test.tsx): session ended on a `logout` message, other messages ignored, channel closed on unmount, no effect without `BroadcastChannel`.
- E2E tests: [`e2e/logout.spec.ts`](../../e2e/logout.spec.ts): logout leads to `/login` and Back does not reopen the app; logout in one tab logs out a second tab. Not run yet (Playwright browsers are not installed locally).

## Open decisions

- Whether to tell the user when the logout request failed (today the failure is silent and the token may stay unrevoked until expiry, although the cookie is deleted). Kept as a choice for now: silent. The user can change it later.
- Session restore after a page reload and handling of `401` from other endpoints: separate issue.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-10-25 | Initial implementation | TBD |
