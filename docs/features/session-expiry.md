# Session expiry

When the session ends because the user was idle, or because a protected endpoint answers `401`, the app takes the user to `/login` and says why: "Your session expired due to inactivity".

|               |                                                                                 |
| ------------- | ------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                     |
| **Issue**     | [#60](https://github.com/Alessia-C/Careme/issues/60)                            |
| **Users**     | Logged-in user                                                                  |
| **Pages**     | `/login` (see [`src/router.tsx`](../../src/router.tsx))                         |
| **Endpoints** | [`/api/auth/logout`](../api/README.md), [`/api/auth/refresh`](../api/README.md) |

## Behavior

1. The session ends in one of three ways:
   - the idle timer of [session renewal](session-renewal.md) runs out;
   - a renewal finds no session (`401`/`403` from `/api/auth/refresh`);
   - a protected request made with `apiFetch` answers `401`.
2. For the idle timer and for `401` the app calls `logout()` first, so the cookies are cleared and the session revoked on the server. Then it clears the auth store and the React Query cache and navigates to `/login` (`replace`). The other tabs are told through the `careme-auth` `BroadcastChannel` and do the same.
3. `/login` focuses the heading and shows an info `Feedback` titled "Your session expired due to inactivity" (`role="status"`), which disappears after 5 seconds or when the user closes it. It uses the same pattern as "You have been signed out" and is linked to the heading with `aria-describedby`.
4. If the `logout()` call does not reach the server, the login page shows the "We couldn't confirm the sign out" warning instead, because the cookie may still be in the browser.

## Business rules

- `apiFetch` ([`src/lib/apiFetch.ts`](../../src/lib/apiFetch.ts)) throws `UnauthorizedError` on `401`. It is for protected endpoints only: `/api/auth/*` keep their own handling.
- The global `onError` of the `QueryCache` and `MutationCache` ([`src/lib/queryClient.ts`](../../src/lib/queryClient.ts)) forwards that error to the handler registered by `useUnauthorizedHandler`, mounted in `AppLayout`. A `401` is never retried.
- Several requests failing together end the session once (one `logout()`, one navigation, one broadcast).
- A `403` is not handled here: it keeps its current behavior.
- The navigation state is `{ signedOut: true, expired: true }`; it is cleared by the login page after it is read.

## Data

None.

## Security and access

- The session is revoked on the server, not only dropped in the browser.
- A `blocked` user gets `403` from `withAuth`, which this feature does not turn into the expired notice.
- No token reaches the page: the session lives in HttpOnly cookies.

## Tests

- Unit tests: [`src/lib/apiFetch.test.ts`](../../src/lib/apiFetch.test.ts), [`src/lib/unauthorized.test.ts`](../../src/lib/unauthorized.test.ts), [`src/lib/queryClient.test.ts`](../../src/lib/queryClient.test.ts), [`src/hooks/useUnauthorizedHandler/useUnauthorizedHandler.test.tsx`](../../src/hooks/useUnauthorizedHandler/useUnauthorizedHandler.test.tsx), [`src/hooks/useSessionRefresh/useSessionRefresh.test.tsx`](../../src/hooks/useSessionRefresh/useSessionRefresh.test.tsx), [`src/hooks/useLogoutSync/useLogoutSync.test.tsx`](../../src/hooks/useLogoutSync/useLogoutSync.test.tsx), [`src/lib/logoutChannel.test.ts`](../../src/lib/logoutChannel.test.ts), [`src/lib/signedOut.test.ts`](../../src/lib/signedOut.test.ts), [`src/pages/LoginPage/LoginPage.test.tsx`](../../src/pages/LoginPage/LoginPage.test.tsx), [`src/routes/AppLayout/AppLayout.test.tsx`](../../src/routes/AppLayout/AppLayout.test.tsx)
- E2E tests: None (no protected endpoint exists yet to call)

## Open decisions

- Whether `401` should show a more neutral text than "inactivity".
- Whether to keep unsaved form data when a session expires: deferred until protected forms exist.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-10-27 | Initial implementation | TBD |
