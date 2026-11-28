# Change password

Lets a logged-in user set a new password by confirming the current one. Only the backend exists: there is no page or form yet.

|               |                                                            |
| ------------- | ---------------------------------------------------------- |
| **Status**    | In progress                                                |
| **Issue**     | [#74](https://github.com/Alessia-C/Careme/issues/74)       |
| **Users**     | Logged-in user                                             |
| **Pages**     | None yet                                                   |
| **Endpoints** | [`POST /api/account/password`](../api/account-password.md) |

## Behavior

1. The caller sends `current_password`, `new_password` and `confirm_password` to `POST /api/account/password`.
2. The input is validated. An invalid input gets `400` with a message, and the current password is not checked.
3. The API verifies the current password with Supabase Auth. A wrong one gets `400 "Current password is incorrect"` and nothing changes.
4. The password is updated and the user's other sessions are revoked.
5. The user stays logged in: the API sets the cookies of the session created by the verification and answers `200` with `"Password updated"` and the new `expires_at`.
6. If anything fails, no cookie is set or cleared and the caller's existing session is not revoked by the API. The session created by the verification, if any, is revoked.

Loading, empty and error states of the page are not defined yet. All error messages are listed in the [endpoint doc](../api/account-password.md#error-cases).

## Business rules

- The current password is always required.
- The new password follows the signup policy: 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character. It is defined once in [`shared/validation.ts`](../../shared/validation.ts).
- The current password is not held to the policy, because it may be older than the policy.
- The confirmation must be identical to the new password.
- The new password must differ from the current one.
- Passwords are never trimmed.
- A body with any other field is refused. The account is always the one of the session: the email is never read from the request.
- A wrong current password is a `400`, never a `401`, so the frontend does not treat it as an expired session.
- After a successful change only the new session remains: every other one is revoked, the previous session of the same browser included. The revocation is best effort: a failure is reported to Sentry and the change still succeeds.

## Data

No application table is written: the password is held by Supabase Auth. [`withAuth`](../../api/_lib/auth.ts) reads the caller's status and profile (`profiles`, [migration](../../supabase/migrations/20260926093507_create_profiles.sql)).

The password rules that Supabase Auth itself enforces are settings of the hosted project, changed in its dashboard (see below). [`supabase/config.toml`](../../supabase/config.toml) does not set them: it applies to a local Supabase stack, which the project does not use ([README](../../README.md)). The 20 character maximum is enforced by the API only.

## Security and access

- Only the user can change their own password: `withAuth` verifies the session, and the email used for the verification comes from it.
- A `blocked` user gets `403` from `withAuth` before any password check. The status check relies on `is_active()` ([`20261018120000_harden_profiles_security.sql`](../../supabase/migrations/20261018120000_harden_profiles_security.sql)).
- `role` and `status` are never read from the request or written here.
- The cookies are `HttpOnly` and `SameSite=Strict`, are set only after the whole change succeeded, and the request must be `application/json` (CSRF defence).
- Passwords and tokens are not collected by Sentry.

### Supabase project settings

The following dashboard settings are agreed, **but not enabled yet and not verified**. The project is shared by all environments, so enabling them affects local dev, previews and production at once.

- "Require current password when updating".
- "Require reauthentication" / "Secure password change".
- Password policy: at least 8 characters, with lowercase, uppercase, numbers and symbols.

From reading the `master` source of Supabase Auth (**not verified on the project**):

- sessions whose `amr` method is `otp`, `recovery` or `magiclink` are not asked for the current password;
- changing the password closes the user's other sessions.

### Known residual risks

- The application has no rate limit on this endpoint. Supabase sees the IP address of Vercel, so its limit is probably shared with login (not verified).
- The current password check of this API does not cover direct calls to Supabase Auth with a valid token, until the project settings are enabled. According to the source reading above, `otp`, `recovery` and `magiclink` sessions would stay exempt.
- The tokens of a recovery link are in the URL (see [`POST /api/auth/reset`](../api/auth-reset.md)).
- A `blocked` user can still change their password by calling Supabase directly, because Supabase Auth ignores `profiles.status`.

## Tests

- Unit tests: [`api/account/_routes/password.test.ts`](../../api/account/_routes/password.test.ts), [`api/account/_validation.test.ts`](../../api/account/_validation.test.ts), [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts) (revocation scope `others`), [`shared/validation.test.ts`](../../shared/validation.test.ts)
- Wiring over HTTP: [`api/account/_app.test.ts`](../../api/account/_app.test.ts)
- E2E tests: None (no UI yet)
- Manual checks against the Supabase project: none run yet (see Open decisions)

## Open decisions

- **Enable and verify the Supabase project settings** listed above (project owner). Until then their effect on this endpoint and on [password reset](../api/auth-reset.md) is unknown.
- **Manual checks on a preview after enabling them**, none run yet:
  - password reset;
  - password change;
  - `POST /api/auth/refresh` with the new cookie;
  - response time under 1 second (issue requirement). The estimate with warm functions is 400-650 ms and has not been measured.
- **Rate limit:** to be handled in a separate future issue, not created yet.
- **Residual risks:** whether to accept or mitigate the ones above is not recorded.
- **Frontend (separate work, not built):**
  - after a `200`, update `expiresAt` in [`authStore`](../../src/stores/authStore.ts) and send it to the other tabs ([`sessionChannel`](../../src/lib/sessionChannel.ts)), as [session renewal](session-renewal.md) does;
  - requests in flight with the old tokens can get `401`. Today a `401` makes the app [log out](session-expiry.md), which would use the new cookies and so end the new session;
  - likewise, a [`POST /api/auth/refresh`](../api/auth-refresh.md) sent with the old refresh cookie can fail with `401`, whose response clears both cookies, possibly the new ones. Both cases come from reading the code and are not tested.
- **Page:** its path, form and loading, success and error states are not defined.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-27 | Initial implementation | TBD |
