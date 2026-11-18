# `POST /api/auth/reset`

Sets a new password using the token from the recovery email, then revokes every session of the user. Called by the reset password page of the frontend (the page does not exist yet), after [`/api/auth/recover`](auth-recover.md).

|            |                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------- |
| **Method** | `POST`                                                                                              |
| **Path**   | `/api/auth/reset`                                                                                   |
| **Source** | [`api/auth/_routes/reset.ts`](../../api/auth/_routes/reset.ts)                                      |
| **Auth**   | None. The recovery token in the body is the only authorization (public endpoint, Supabase anon key) |
| **Status** | Experimental                                                                                        |

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

| Field      | Type     | Required | Constraints                                                                                                              | Description                                                                        |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `token`    | `string` | Yes      | Non-empty after trimming                                                                                                 | The `token_hash` from the link in the recovery email                               |
| `password` | `string` | Yes      | 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character (`!@#$%^&*(),.?":{}\|<>`) | New password, same policy as signup (`validatePassword` in `shared/validation.ts`) |

```json
{
  "token": "pkce_1a2b3c...",
  "password": "NewValid123!"
}
```

An `email` field, if sent, is ignored: the account is the one the token belongs to.

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

The checks run in this order, and the first that fails answers: token, password policy, token verification (`verifyOtp`), blocked check, password update, global session revocation.

| Status                       | When                                                                                                                                                                               | Example body                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `400 Bad Request`            | The body is missing or is not a JSON object                                                                                                                                        | `{ "message": "Missing or invalid request body" }`                                                                                      |
| `400 Bad Request`            | `token` is missing, not a string or empty, whatever the password is                                                                                                                | `{ "message": "Invalid or expired link" }`                                                                                              |
| `400 Bad Request`            | `password` is missing, not a string or does not meet the policy. Checked before the token is verified, so the link is not consumed                                                 | `{ "message": "Invalid password: use 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character" }` |
| `400 Bad Request`            | Supabase rejects the token with any 4xx (unknown, expired or already used)                                                                                                         | `{ "message": "Invalid or expired link" }`                                                                                              |
| `400 Bad Request`            | Supabase rejects the new password as weak (`weak_password`). Same message as the policy error                                                                                      | `{ "message": "Invalid password: use 8-20 characters ..." }`                                                                            |
| `400 Bad Request`            | The new password is the same as the current one (`same_password`)                                                                                                                  | `{ "message": "The new password must be different from the current one" }`                                                              |
| `403 Forbidden`              | The token is valid but the profile is not active (`blocked`). The password is not changed                                                                                          | `{ "message": "Account blocked" }`                                                                                                      |
| `405 Method Not Allowed`     | The method is not `POST`                                                                                                                                                           | `{ "message": "Method not allowed" }`                                                                                                   |
| `415 Unsupported Media Type` | The `Content-Type` is not `application/json`                                                                                                                                       | `{ "message": "Content-Type must be application/json" }`                                                                                |
| `429 Too Many Requests`      | Supabase's rate limit is exceeded, in `verifyOtp` or in the password update                                                                                                        | `{ "message": "Too many requests, please try again later" }`                                                                            |
| `500 Internal Server Error`  | Supabase returns a non-4xx error or an unexpected result (for example no session after `verifyOtp`), the active check fails, or an env var is missing. The error is sent to Sentry | `{ "status": "error", "message": "Internal server error" }`                                                                             |

## Example

```bash
curl -X POST http://localhost:3000/api/auth/reset \
  -H "Content-Type: application/json" \
  -d '{"token":"<token_hash from the email link>","password":"NewValid123!"}'
```

## Notes

- **The token is the only authorization:** the endpoint never reads an email from the body. It calls `verifyOtp({ token_hash, type: 'recovery' })`, which identifies the user.
- **Order matters:** the password policy is checked before `verifyOtp`, because `verifyOtp` consumes the token: a weak password must not burn the link the user still needs. A `400` for the policy can therefore be retried with the same link.
- **One-time link:** once `verifyOtp` succeeds the token is spent. If a later step fails (`same_password`, `weak_password` from Supabase, rate limit, `500`), the user has to request a new link with [`/api/auth/recover`](auth-recover.md).
- **Blocked users:** Supabase Auth ignores `profiles.status`, so a blocked user can verify the link. The endpoint checks `is_active()` with the recovery session's own token (RLS applies) before changing anything. If the account is not active it revokes that session (best effort, scope `local`) and answers `403`, without changing the password.
- **Session revocation:** after the password is updated, all the user's sessions are revoked (`signOut` with scope `global`), the recovery one included, because the account may be in someone else's hands. It is best effort: if the revoke fails, the answer is still `200` and the error is reported to Sentry (tag `context: revoke-sessions-after-password-reset`). Access tokens already issued stay valid until they expire.
- **No cookies:** unlike [`/api/auth/login`](auth-login.md), no session cookie is set. The user logs in again with the new password.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)). `APP_URL` is needed only by [`/api/auth/recover`](auth-recover.md). The service role key is not used.
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
