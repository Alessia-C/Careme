# Logout

Lets a logged-in user end their session from the header of any protected page. The session is revoked on the server, both session cookies (access and refresh) are deleted and every other tab of the same browser leaves the app too.

|               |                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                              |
| **Issue**     | [#59](https://github.com/Alessia-C/Careme/issues/59)                                     |
| **Users**     | Logged-in user                                                                           |
| **Pages**     | Header of every protected page, `/` today (see [`src/router.tsx`](../../src/router.tsx)) |
| **Endpoints** | [`POST /api/auth/logout`](../api/auth-logout.md)                                         |

## Behavior

1. The user clicks "Logout" in [`AppHeader`](../../src/routes/AppLayout/components/AppHeader/AppHeader.tsx) (see [App layout](app-layout.md)).
2. While the request is in progress the button has `aria-disabled="true"` instead of `disabled`: it stays focusable (a disabled button that has focus loses it), clicks are ignored so the request cannot be sent twice, and CSS makes it look disabled. The header also has a visually hidden live region (`role="status"`, always in the DOM) that reads "Logging out…" while the request is in progress and is empty otherwise, so screen reader users hear that something is happening.
3. The app sends `POST /api/auth/logout` with the body `{}` and `Content-Type: application/json` (the API requires it as CSRF defence and ignores the content). The browser attaches the HttpOnly session cookie by itself.
4. When the request ends, whatever the outcome (success, `401`, other error, network failure), the app:
   - empties the in-memory auth store (user and role);
   - clears the whole React Query cache, so the next user never sees cached data;
   - navigates to `/login` with the history entry replaced, so Back does not return to the protected page, passing a navigation state ([`src/lib/signedOut.ts`](../../src/lib/signedOut.ts)): `SIGNED_OUT_STATE` (`{ signedOut: true, confirmed: true }`) when the API answered `200` or `401`, `SIGN_OUT_UNCONFIRMED_STATE` (`{ signedOut: true, confirmed: false }`) when the request failed (network error, `429`, `500`...);
   - sends `logout` (confirmed) or `logout-unconfirmed` to the other tabs.
5. The user always lands on `/login`. A failed request is not shown in the header, but the login page warns about it (next step).
6. Because the Logout button no longer exists on `/login`, the [login page](login.md) reads the state through `getSignOutNotice()` and moves the keyboard focus to the `h1`, so keyboard and screen reader users do not start from `<body>`. It shows one of two messages:
   - confirmed logout: info `Feedback` titled "You have been signed out" (`role="status"`), which disappears after 5 seconds;
   - unconfirmed logout: error `Feedback` (`role="alert"`) titled "We couldn't confirm the sign out", with the description "Your session may still be active on this device. Close this browser window, or sign in and sign out again." It has no timer and stays until the user closes it.

   Both messages have a close button (`aria-label="Close message"`). Closing a message (or the timer closing it while the focus is on it) moves the focus to the `h1`, so it does not fall back to `<body>`. The message is after the form in the DOM, because it is shown at the bottom of the page: the tab order matches what is seen. The close button is at least 24x24px and its icon stays visible in forced-colors mode. The `h1` has `aria-describedby` pointing at the message, so a screen reader reads it together with the title; without a message the attribute is not present. On a normal visit to `/login` there is no message and the focus is not moved. A state without `confirmed` is treated as confirmed.

7. Other tabs of the same browser: [`useLogoutSync`](../../src/hooks/useLogoutSync/useLogoutSync.ts), mounted in `AppLayout`, listens through `listenForLogout()` in [`src/lib/logoutChannel.ts`](../../src/lib/logoutChannel.ts) on the `BroadcastChannel` named `careme-auth`. It handles two messages, `logout` and `logout-unconfirmed`, and calls `onLogout(confirmed)`. It then runs the same cleanup as step 4 (store, cache, redirect to `/login` with replace and the matching state, so the same message appears there) through [`useEndSession`](../../src/hooks/useEndSession/useEndSession.ts), whose `endSession(confirmed = true)` picks the state, and does not call the API again. The sending tab uses `broadcastLogout(confirmed = true)` from the same file. The messages carry no data and a tab never receives its own message. Any other message is ignored.

## Business rules

- The client treats `200` and `401` as a successful logout (`401` means the session was already over). Any other status or a network error is a failure, but the local session is dropped anyway: the user asked to leave, and the device may be shared. The failure is reported on the login page as an unconfirmed logout.
- A failed request can leave the token unrevoked on Supabase until it expires. If the request reached the API (`429`, `500`) the API still deletes the cookie. If it never reached the server (network failure) the HttpOnly cookie cannot be deleted by JavaScript and may still be in the browser: this is why the user is warned and told to close the browser window or to sign in and out again.
- The same logout runs by itself when an idle session lapses (see [Session renewal](session-renewal.md)): the hook calls `logout()`, then ends the session and tells the other tabs, and the login shows "Your session expired due to inactivity" (see [Session expiry](session-expiry.md)). By then the access token cookie has expired, so the API revokes the session through the refresh cookie (see [`docs/api/auth-logout.md`](../api/auth-logout.md)).
- Only the current session is revoked, not the user's sessions on other devices (the API uses scope `local`).
- Tab synchronization is best effort: where `BroadcastChannel` does not exist nothing happens, and the other tabs find out on their next request. It works only inside one browser profile, not across browsers or devices.
- After a page reload the session is restored by [Session restore](session-restore.md); logging out never triggers a new restore.

## Data

None. The feature reads and writes no table. The API revokes the session in Supabase Auth and deletes the cookies `__Host-sb-access-token` and `__Secure-sb-refresh-token` (`sb-access-token` and `sb-refresh-token` under `vercel dev`) by sending them again with `Max-Age=0`; see [`docs/api/auth-logout.md`](../api/auth-logout.md). The frontend goes through `logout()` in [`src/lib/authApi.ts`](../../src/lib/authApi.ts), which never throws and returns `{ ok: true }` or `{ ok: false, reason: 'failed' }`.

## Security and access

- Only reachable from protected pages (behind `ProtectedRoute`); the API itself accepts the token from the header or from the cookie.
- A `blocked` user can still log out: the endpoint does not use `withAuth`, so they can revoke their session.
- The cookie is deleted by the server because it is HttpOnly and scripts cannot touch it. It is deleted on every outcome of the handler (`200`, `401`, `429`, `500`), because the client drops its local session anyway and a shared device must not keep a usable cookie. It is not sent on `405`, `415` and `400`, which are rejected before the handler. This is on purpose: a cross-site form that fails the CSRF checks must not be able to force a logout by deleting the cookie. If both a Bearer header and the cookie arrive, the Bearer token is revoked and the cookie is deleted anyway.
- The endpoint requires `Content-Type: application/json` and an object body (CSRF defence: a cross-site form cannot send it without a CORS preflight). Wrong content type gives `415`, a missing or non-object body gives `400`.
- Clearing the React Query cache and the store on logout avoids leaking one user's data to the next user of the same device.
- The broadcast message contains no token or user data.
- Nothing is writable from this feature.

## Tests

- Unit tests:
  - [`api/auth/logout.test.ts`](../../api/auth/logout.test.ts): `405`, `415` and `400` (CSRF defence), token from header or cookie (header wins), `Set-Cookie` deletion on `200`, `401`, `429` and `500`, blocked user not checked (profile status is never read).
  - [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts): `getAccessToken` (header, cookie, priority, empty cookie) and `buildClearedSessionCookie`.
  - [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts): `logout()` status mapping and the JSON request.
  - [`src/lib/signedOut.test.ts`](../../src/lib/signedOut.test.ts): `getSignOutNotice()` for confirmed, unconfirmed and missing `confirmed`, and invalid states.
  - [`src/lib/logoutChannel.test.ts`](../../src/lib/logoutChannel.test.ts): both messages, no delivery to the sender, own channel and no data, other messages ignored, channels closed, no effect without `BroadcastChannel`.
  - [`src/components/Feedback/Feedback.test.tsx`](../../src/components/Feedback/Feedback.test.tsx): close button only with `onClose`, mouse and keyboard close, `id`.
  - [`src/pages/LoginPage/LoginPage.test.tsx`](../../src/pages/LoginPage/LoginPage.test.tsx) (block "after a logout"): signed-out message and focus on the heading; nothing on a normal visit; close button; `aria-describedby` on the heading (absent without message); unconfirmed alert that stays with no timer; navigation state cleared in both cases.
  - [`src/routes/AppLayout/components/AppHeader/AppHeader.test.tsx`](../../src/routes/AppLayout/components/AppHeader/AppHeader.test.tsx): API call, store emptied, redirect to `/login`, cache cleared, other tabs notified, button `aria-disabled` (still focusable, click ignored) while in flight and not otherwise, empty status region until a logout is in progress, redirect with the confirmed navigation state, and with the unconfirmed state when the request fails.
  - [`src/routes/AppLayout/AppLayout.test.tsx`](../../src/routes/AppLayout/AppLayout.test.tsx): skip link and Logout in the layout (existing tests only; it does not assert the tab synchronization, which is covered by `useLogoutSync.test.tsx`).
  - [`src/hooks/useLogoutSync/useLogoutSync.test.tsx`](../../src/hooks/useLogoutSync/useLogoutSync.test.tsx): session ended on a `logout` or `logout-unconfirmed` message (with the matching state), other messages ignored, channel closed on unmount, no effect without `BroadcastChannel`.
- E2E tests: [`e2e/logout.spec.ts`](../../e2e/logout.spec.ts): 4 tests: logout leads to `/login` and Back does not reopen the app; logout in one tab logs out a second tab; a logout that cannot reach the server shows the warning, which can be closed; the signed-out message can be closed before it disappears. Firefox and WebKit run in CI.

## Open decisions

- Handling of `401` from other endpoints: separate issue.

## Changelog

| Date       | Change                                                                                                        | PR  |
| ---------- | ------------------------------------------------------------------------------------------------------------- | --- |
| 2026-10-25 | Initial implementation                                                                                        | TBD |
| 2026-10-26 | Unconfirmed logout warning, close buttons, `aria-describedby`, `aria-disabled` button, two broadcast messages | TBD |
