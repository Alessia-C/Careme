# Login

Lets an existing user sign in to Careme with email and password. The session is kept in an HttpOnly cookie set by the API, so the page's JavaScript never sees the token.

|               |                                                         |
| ------------- | ------------------------------------------------------- |
| **Status**    | In progress                                             |
| **Issue**     | [#58](https://github.com/Alessia-C/Careme/issues/58)    |
| **Users**     | Anonymous                                               |
| **Pages**     | `/login` (see [`src/router.tsx`](../../src/router.tsx)) |
| **Endpoints** | [`POST /api/auth/login`](../api/auth-login.md)          |

## Behavior

1. The user opens `/login`, directly or because [`ProtectedRoute`](../../src/routes/ProtectedRoute.tsx) redirected them there from a protected page (the URL then carries `?next=<original path>`). The page uses the same layout as the signup page. The document title is "Login – Careme" and the heading is "Sign in to your account".
2. The form has two fields: Email\* and Password\* (with a show/hide toggle). Below them there are:
   - a "Forgot password?" button that is always disabled, because password recovery does not exist yet;
   - the "Sign in" button;
   - the text "You don’t have an account?" with a "Go to the registration" link to `/signup`.
3. Validation:
   - Email shows "Enter a valid email address" only after the field has been blurred. It uses the same email check as signup.
   - Password only has to be non-empty. The signup password policy is not applied and no requirements checklist is shown; an empty password is marked as invalid after blur.
4. The "Sign in" button is disabled until the email is valid and the password is not empty.
5. On submit the page sends `POST /api/auth/login` with `email` and `password`. While the request is in progress the button is disabled and its label is "Signing in…". A second submit is ignored.
6. On success the user (`id`, `email`) and the role from the response are stored in the in-memory auth store, and the app navigates (history entry replaced, so Back does not return to the form) to the `next` path, or to `/` when `next` is missing or not a safe path.
7. On failure the form stays on screen with the entered values and an error `Feedback` (role alert) titled "Something went wrong" above the fields. The button is enabled again so the user can retry:
   - `400` or `403`: "Invalid email or password."
   - `429`: "Too many attempts. Please wait a moment and try again."
   - any other non-2xx status, a network error, or a `200` whose body does not contain a valid user and role: "We couldn’t complete your request. Please try again."
8. If the auth store already holds a session when `/login` renders, the user is redirected to `/` (history entry replaced) without seeing the form.
9. After a [logout](logout.md) (also one done in another tab) the user arrives with the navigation state `{ signedOut: true }`. The page then shows an info `Feedback` above the form titled "You have been signed out" with the text "Sign in again to continue.", and moves the keyboard focus to the `h1`. Without that state (direct visit, redirect from a protected page) nothing is shown and the focus is not moved. The state lives in the history entry, so it is not kept in the URL.

## Business rules

- Wrong credentials (`400`) and blocked or unconfirmed accounts (`403`) show the same generic message, so the UI never reveals whether an email is registered or what state the account is in.
- The only errors with their own message are the rate limit (`429`) and the generic "try again" message for network or server failures.
- After login the user is sent to `next` only if it is an internal path: it must start with `/` and must not start with `//` or `/\`. Anything else (another origin, protocol-relative URL) is ignored and the user goes to `/`. This avoids an open redirect. The rule lives in [`src/lib/redirect.ts`](../../src/lib/redirect.ts) (`getSafeNextPath`).
- The role returned by the API is only a hint for the UI. Authorization is always enforced by the API and RLS.
- The session is not restored after a page reload yet: the auth store is in memory only, so after a reload a protected page redirects to `/login` again even though the cookie may still be valid.

## Data

The page reads and writes no table directly. The API authenticates through Supabase Auth, checks the profile status with `is_active()` and reads `profiles.role` (see [`docs/api/auth-login.md`](../api/auth-login.md)). The frontend never talks to Supabase directly: the request goes through [`src/lib/authApi.ts`](../../src/lib/authApi.ts), whose `login()` returns `{ ok: true, user: { id, email }, role }` or `{ ok: false, reason: 'invalid-credentials' | 'rate-limited' | 'failed' }`.

The access token is stored by the browser in the `__Host-sb-access-token` cookie (`HttpOnly`, `Secure` except under `vercel dev`, `SameSite=Strict`, `Path=/`, `Max-Age` equal to the token's `expires_in`). The refresh token is neither stored nor exposed. The in-memory auth store ([`src/stores/authStore.ts`](../../src/stores/authStore.ts)) keeps only the user and the role.

## Security and access

- The route is public.
- The token is in an HttpOnly cookie, so scripts (and any XSS) cannot read it. `SameSite=Strict` is the CSRF protection: the browser does not send the cookie on cross-site requests.
- The password is held only in component state and sent only in the request body.
- A `blocked` user cannot log in: the API answers `403` and sets no cookie. The UI shows the same generic message as for wrong credentials.
- Nothing privileged is writable from this feature: the form sends only `email` and `password`.

## Tests

- Unit tests:
  - [`src/pages/LoginPage/LoginPage.test.tsx`](../../src/pages/LoginPage/LoginPage.test.tsx): form and signup link, disabled "Forgot password?", button disabled/enabled, no signup password policy, inline errors after blur, request and session stored, `next` honored, external `next` ignored, redirect when already authenticated, signed-out message and focus after a logout (and none on a normal visit), progress state, rate-limit message, network failure and retry.
  - [`src/lib/redirect.test.ts`](../../src/lib/redirect.test.ts): `getSafeNextPath` with internal and unsafe paths.
  - [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts): `login()` status mapping and response validation.
  - [`src/router.test.tsx`](../../src/router.test.tsx): unauthenticated access to a protected page redirects to `/login?next=...`.
  - [`api/auth/login.test.ts`](../../api/auth/login.test.ts) and [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts): the cookie, the body without tokens, and `withAuth` accepting the cookie.
- E2E tests: None.

## Open decisions

- Out of scope, planned for later issues: session restore after a reload, refresh token handling and handling of `401` responses in the client.
- Password recovery does not exist: the "Forgot password?" button stays disabled until it is defined.
- Whether the user should get a specific message for an unconfirmed email (today the `403` is shown as the generic invalid-credentials message) is not defined in the code.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-10-25 | Initial implementation | TBD |
