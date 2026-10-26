# Session renewal

Keeps an active user signed in beyond the 60 minutes of the access token, by renewing the session shortly before it expires. A user who is idle is not renewed: when the session expires the app logs them out on the server (clearing the cookies and revoking the session) and takes them to the login.

|               |                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                                                                            |
| **Issue**     | [#130](https://github.com/Alessia-C/Careme/issues/130)                                                                                 |
| **Users**     | Logged-in user                                                                                                                         |
| **Pages**     | Every protected page: the hook runs in [`AppLayout`](../../src/routes/AppLayout.tsx), see [`src/router.tsx`](../../src/router.tsx)     |
| **Endpoints** | [`POST /api/auth/refresh`](../api/auth-refresh.md), plus `expires_at` in [`login`](../api/auth-login.md) and [`me`](../api/auth-me.md) |

## Behavior

1. Login and session restore return `expires_at` (Unix time in seconds). The page keeps it in the auth store (`expiresAt` in [`authStore`](../../src/stores/authStore.ts)); the tokens stay in HttpOnly cookies and never reach the page's JavaScript.
2. [`useSessionRefresh`](../../src/hooks/useSessionRefresh.ts) runs in the protected layout. It waits until 60 seconds before `expiresAt` (very long waits are split in chunks, because `setTimeout` overflows after about 24.8 days).
3. At that moment:
   - **The user was active** (a `pointerdown`, `keydown` or `scroll` event since the last renewal, or since the page was loaded for the first renewal): the page calls `POST /api/auth/refresh`. On success the new `expires_at` goes into the store, which schedules the next renewal, and is sent to the other tabs.
   - **The user was not active**: nothing is renewed. The page keeps waiting. If activity happens before `expiresAt`, it renews at once. If not, at `expiresAt` the session is ended: the store and the React Query cache are cleared and the user goes to `/login` (same as after a logout, through `useEndSession`).
4. Activity is counted per renewal: activity from before the last renewal does not count for the next one.
5. Failures of the renewal call:
   - **`401` or `403`** (refresh cookie missing, expired or already used; blocked user): the session is gone, so the user is taken to `/login`. The API has already deleted the cookies.
   - **Network error, `429`, `5xx` or malformed body**: the session may still be valid, so the user is not logged out. The page tries again after 15 seconds, until it succeeds or the session ends.
6. Only one renewal runs at a time in a tab.
7. **Several tabs:** the cookies are shared by all tabs. When a tab renews, it posts the new expiry on a `BroadcastChannel` named `careme-session` ([`sessionChannel.ts`](../../src/lib/sessionChannel.ts)) and the other tabs update their store, so an idle tab does not end the session at the old expiry. A browser without `BroadcastChannel` simply does not notify the other tabs.

## Business rules

- The access token expires after 60 minutes. It is renewed 60 seconds before that, and only if the user was active since the last renewal.
- The refresh cookie lives at most 7 days (`Max-Age`), so an idle browser is signed out after that.
- A blocked user cannot renew: the API answers `403` and the user returns to the login.
- Refresh tokens are single use: each renewal rotates both cookies.
- A network or server failure never logs the user out by itself.

## Data

None. The feature reads and writes no table, except that the API reads the profile status through the `is_active()` database function. The only client state is `expiresAt` in the in-memory auth store.

## Security and access

- Both tokens are in HttpOnly, `SameSite=Strict` cookies. The refresh cookie has `Path=/api/auth`, so it is sent only to the auth endpoints, and the `__Secure-` prefix in production (`__Host-` is not possible with a path other than `/`).
- The API checks that the profile is active with the new JWT before setting any cookie, so a blocked user never receives a new session. RLS applies to that check.
- The broadcast message holds only the expiry number: no token, no user data.
- The endpoint requires a JSON `Content-Type` as CSRF defence, see [`docs/api/auth-refresh.md`](../api/auth-refresh.md).
- When an idle session lapses the app calls [logout](logout.md) like the Logout button does, and tells the other tabs. The access token cookie is already gone at that point, so the API revokes the session through the refresh cookie (see [`docs/api/auth-logout.md`](../api/auth-logout.md)). If the call fails (network), the login page warns that the cookie may still be in the browser.
- Known limit: a user blocked after login keeps the access token until it expires, as before; the renewal is refused from then on.

## Tests

- Unit tests:
  - [`api/auth/refresh.test.ts`](../../api/auth/refresh.test.ts): `405`, `415`, success (new session, no tokens in the body, both cookies in one header, `no-store`, status check with the new JWT), `401` with cookies cleared, `403` for a blocked account, generic `500` with Supabase failures.
  - [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts), [`api/auth/login.test.ts`](../../api/auth/login.test.ts), [`api/auth/logout.test.ts`](../../api/auth/logout.test.ts), [`api/auth/me.test.ts`](../../api/auth/me.test.ts): cookie helpers and `expires_at`.
  - [`src/hooks/useSessionRefresh.test.tsx`](../../src/hooks/useSessionRefresh.test.tsx): renewal timing, idle user, return before expiry, `401` to login, retry after a network error, tabs, cleanup.
  - [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts), [`src/stores/authStore.test.ts`](../../src/stores/authStore.test.ts), [`src/routes/SessionRestore.test.tsx`](../../src/routes/SessionRestore.test.tsx), [`src/pages/LoginPage/LoginPage.test.tsx`](../../src/pages/LoginPage/LoginPage.test.tsx): `refreshSession()`, `expiresAt` in the store, `expires_at` saved on restore and login.
- E2E tests: no spec covers the renewal itself; [`e2e/logout.spec.ts`](../../e2e/logout.spec.ts) and [`e2e/session-restore.spec.ts`](../../e2e/session-restore.spec.ts) were adapted to the new `expires_at` field.

## Open decisions

- Whether the 60-minute inactivity policy and the 7-day refresh cookie lifetime are final: not stated in the code, which only implements them.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-10-26 | Initial implementation | TBD |
