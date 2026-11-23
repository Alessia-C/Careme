# `POST /api/auth/reset`

Sets a new password using the recovery session that the emailed link creates, then revokes every session of the user. Called by the reset password page of the frontend (the page does not exist yet), after [`/api/auth/recover`](auth-recover.md).

|            |                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| **Method** | `POST`                                                                                                        |
| **Path**   | `/api/auth/reset`                                                                                             |
| **Source** | [`api/auth/_routes/reset.ts`](../../api/auth/_routes/reset.ts)                                                |
| **Auth**   | None. The recovery session tokens in the body are the only authorization (public endpoint, Supabase anon key) |
| **Status** | Experimental                                                                                                  |

## Parameters

### Path parameters

None.

### Query parameters

None.

### Headers

| Name           | Required | Description        |
| -------------- | -------- | ------------------ |
| `Content-Type` | Yes      | `application/json` |

## Request body

`Content-Type: application/json`

| Field          | Type     | Required | Constraints                                                                                                              | Description                                                                        |
| -------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `accessToken`  | `string` | Yes      | Non-empty after trimming. Must be an unexpired recovery session token issued in the last 15 minutes (see Notes)          | The `access_token` from the fragment of the page the recovery link opens           |
| `refreshToken` | `string` | Yes      | Non-empty after trimming                                                                                                 | The `refresh_token` from the same fragment                                         |
| `password`     | `string` | Yes      | 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character (`!@#$%^&*(),.?":{}\|<>`) | New password, same policy as signup (`validatePassword` in `shared/validation.ts`) |

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "v1.abc...",
  "password": "NewValid123!"
}
```

An `email` field, if sent, is never read: the account is the one the session belongs to.

## Response

### `200 OK`

| Field     | Type     | Description                 |
| --------- | -------- | --------------------------- |
| `message` | `string` | Always `"Password updated"` |

```json
{
  "message": "Password updated"
}
```

No cookie is set and no session is returned. The user must log in again with the new password.

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

The checks run in this order, and the first that fails answers: tokens are non-empty strings and the access token is an unexpired, recent recovery session (`exp` and `amr` claims), password policy, session verification (`setSession`), check that Supabase returned the same access token, blocked check, password update, global session revocation.

| Status                       | When                                                                                                                                                                                                                                                                                                                           | Example body                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `400 Bad Request`            | The body is missing or is not a JSON object                                                                                                                                                                                                                                                                                    | `{ "message": "Missing or invalid request body" }`                                                                                      |
| `400 Bad Request`            | `accessToken` or `refreshToken` is missing, not a string or empty; or the access token is not a recent recovery session: no numeric `exp`, already expired, or no `otp`/`recovery` `amr` entry with a timestamp from 60 seconds in the future to 15 minutes in the past (for example a normal login). Whatever the password is | `{ "message": "Invalid or expired link" }`                                                                                              |
| `400 Bad Request`            | `password` is missing, not a string or does not meet the policy. Checked before the session is verified                                                                                                                                                                                                                        | `{ "message": "Invalid password: use 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character" }` |
| `400 Bad Request`            | Supabase rejects the session in `setSession` with any 4xx (unknown, expired or revoked)                                                                                                                                                                                                                                        | `{ "message": "Invalid or expired link" }`                                                                                              |
| `400 Bad Request`            | After `setSession`, the access token Supabase returns differs from the one sent. The rebuilt session is revoked (scope `local`)                                                                                                                                                                                                | `{ "message": "Invalid or expired link" }`                                                                                              |
| `400 Bad Request`            | Supabase rejects the new password as weak (`weak_password`). Same message as the policy error                                                                                                                                                                                                                                  | `{ "message": "Invalid password: use 8-20 characters ..." }`                                                                            |
| `400 Bad Request`            | The new password is the same as the current one (`same_password`)                                                                                                                                                                                                                                                              | `{ "message": "The new password must be different from the current one" }`                                                              |
| `403 Forbidden`              | The session is valid but the profile is not active (`blocked`). The password is not changed                                                                                                                                                                                                                                    | `{ "message": "Account blocked" }`                                                                                                      |
| `405 Method Not Allowed`     | The method is not `POST`                                                                                                                                                                                                                                                                                                       | `{ "message": "Method not allowed" }`                                                                                                   |
| `415 Unsupported Media Type` | The `Content-Type` is not `application/json`                                                                                                                                                                                                                                                                                   | `{ "message": "Content-Type must be application/json" }`                                                                                |
| `429 Too Many Requests`      | Supabase's rate limit is exceeded, in `setSession` or in the password update                                                                                                                                                                                                                                                   | `{ "message": "Too many requests, please try again later" }`                                                                            |
| `500 Internal Server Error`  | Supabase returns a non-4xx error or an unexpected result (for example no session after `setSession`), the active check fails, the password update fails unexpectedly, or an env var is missing. The error is sent to Sentry and the recovery session is revoked (scope `local`)                                                | `{ "status": "error", "message": "Internal server error" }`                                                                             |

## Example

```bash
curl -X POST http://localhost:3000/api/auth/reset \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"<access_token from the URL fragment>","refreshToken":"<refresh_token from the URL fragment>","password":"NewValid123!"}'
```

## Notes

- **How the link works:** the recovery email is not changed (the Supabase project has no custom SMTP, so the default template cannot be edited). Its link goes to Supabase, which verifies it and redirects the browser to `<APP_URL>/reset-password#access_token=...&refresh_token=...`. The frontend (separate issue) reads the fragment, removes it from the URL and sends the two tokens to this endpoint with the new password.
- **Only a recovery session is accepted:** the endpoint changes a password without asking for the current one, so a normal login session (`amr` method `password`), or a stolen one, must not be enough to take over the account. The endpoint reads the claims of the access token and requires a numeric `exp` that is not in the past and an `otp` or `recovery` `amr` entry whose timestamp is between 60 seconds in the future (tolerance for a clock slightly ahead) and 15 minutes in the past; otherwise it answers `400 "Invalid or expired link"`. The claims are read without verifying the signature, so this is only a pre-filter that runs before anything is sent to Supabase (it also stops an ordinary session from being refreshed, and so rotated, by `setSession`).
- **Why `exp` is required:** `setSession` verifies the access token only when it has a valid `exp`; without one it ignores the token and builds the session from the refresh token alone, whose claims were never checked. A token with a forged `amr` and no `exp` would therefore get past the pre-filter.
- **Same token back:** a forged claim is not stopped by the later Supabase call on its own. After `setSession` the endpoint requires that the access token of the session is exactly the one sent. If it differs, Supabase did not verify the token sent but built a new session from the refresh token, so the checked claims say nothing about it: that session is revoked (best effort, scope `local`) and the answer is `400 "Invalid or expired link"`.
- **The session is not authorization by itself:** the endpoint never reads an email from the body. The user is the one the verified session belongs to.
- **Order matters:** the filter and the password policy run before `setSession`, so a weak password never reaches Supabase. A weak password consumes nothing: using the session does not spend it, and a `400` for the policy can be retried with the same tokens.
- **Retry and failure paths:** errors the user can fix (`same_password`, `weak_password` from Supabase, `429`) leave the recovery session open, so the user can retry with the same link within the 15 minutes without a new email (the email limit of Supabase is low). Unexpected errors after `setSession` (a failure of the `is_active()` check, an unexpected error from `updateUser`) revoke the recovery session (best effort, scope `local`, Sentry tag `context: revoke-recovery-session-after-error`) and answer `500`, because its tokens would otherwise stay usable and may be in the browser history.
- **Blocked users:** Supabase Auth ignores `profiles.status`, so a blocked user gets a recovery session too. The endpoint checks `is_active()` with the session's own token (RLS applies) before changing anything. If the account is not active it revokes that session (best effort, scope `local`) and answers `403`, without changing the password.
- **Session revocation:** after the password is updated, all the user's sessions are revoked (`signOut` with scope `global`), the recovery one included, because the account may be in someone else's hands. It is best effort: if the revoke fails, the answer is still `200` and the error is reported to Sentry (tag `context: revoke-sessions-after-password-reset`). Access tokens already issued stay valid until they expire.
- **Sentry and privacy:** the request carries a password and session tokens, so [`api/_lib/sentry.ts`](../../api/_lib/sentry.ts) turns off the collection of request bodies, cookies, headers, the query string, stack frame variables and database query data, and a `beforeSend` hook deletes `request.data` and `request.cookies` from every event. An error report holds only the message, the stack and the route tag.
- **No cookies:** unlike [`/api/auth/login`](auth-login.md), no session cookie is set. The user logs in again with the new password.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)). `APP_URL` is needed only by [`/api/auth/recover`](auth-recover.md). The service role key is not used.
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
