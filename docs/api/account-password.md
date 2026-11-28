# `POST /api/account/password`

Changes the password of the authenticated user after checking the current one, closes the user's other sessions and moves the caller to a new session. Meant for the account page of the frontend, which does not exist yet.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `POST`                                                                       |
| **Path**   | `/api/account/password`                                                      |
| **Source** | [`api/account/_routes/password.ts`](../../api/account/_routes/password.ts)   |
| **Auth**   | Supabase user JWT (`Authorization: Bearer <access_token>` or session cookie) |
| **Status** | Experimental                                                                 |

## Parameters

### Path parameters

None

### Query parameters

None

### Headers

| Name            | Required | Description                                                    |
| --------------- | -------- | -------------------------------------------------------------- |
| `Authorization` | No       | `Bearer <access_token>`. Without it the session cookie is used |
| `Content-Type`  | Yes      | `application/json`                                             |

## Request body

`Content-Type: application/json`, at most 10 KB.

| Field              | Type     | Required | Constraints                                                                                                                                              | Description                |
| ------------------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `current_password` | `string` | Yes      | Not empty. The password policy is not applied to it                                                                                                      | The password in use now    |
| `new_password`     | `string` | Yes      | 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character (`!@#$%^&*(),.?":{}\|<>`). Different from the current one | The new password           |
| `confirm_password` | `string` | Yes      | Identical to `new_password`                                                                                                                              | The new password, repeated |

Passwords are never trimmed: spaces are part of them. **Any other field is refused** with `400`, including `email`. The password policy is the one of signup (`validatePassword` in [`shared/validation.ts`](../../shared/validation.ts)).

```json
{
  "current_password": "Current123!",
  "new_password": "NewValid123!",
  "confirm_password": "NewValid123!"
}
```

## Response

### `200 OK`

| Field        | Type     | Description                                                      |
| ------------ | -------- | ---------------------------------------------------------------- |
| `message`    | `string` | Always `"Password updated"`                                      |
| `expires_at` | `number` | Unix time in seconds when the new access token stops being valid |

```json
{
  "message": "Password updated",
  "expires_at": 1793000000
}
```

The body contains no token. The new session travels in a single `Set-Cookie` header (an array of two cookies), which replaces the previous ones:

| Cookie                                                                              | Attributes                                                                   |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `__Host-sb-access-token=<access_token>` (`sb-access-token` under `vercel dev`)      | `HttpOnly; SameSite=Strict; Path=/; Max-Age=<expires_in>; Secure`            |
| `__Secure-sb-refresh-token=<refresh_token>` (`sb-refresh-token` under `vercel dev`) | `HttpOnly; SameSite=Strict; Path=/api/auth; Secure` (session cookie, no age) |

`Secure` is omitted under `vercel dev`. The cookies are set only when the password was changed: no error response sets or clears them.

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

The checks run in this order, and the first that fails answers: JSON parsing of the body, path and method, authentication and account status (`withAuth`), content type and body shape, field validation (unknown fields, current password, new password policy, confirmation, new differs from current), verification of the current password, password update.

| Status                       | When                                                                                                                           | Example body                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `400 Bad Request`            | The JSON is malformed or larger than 10 KB. Checked first, so also without a session                                           | `{ "message": "Missing or invalid request body" }`                                                                                      |
| `400 Bad Request`            | The body is missing or is not a JSON object                                                                                    | `{ "message": "Missing or invalid request body" }`                                                                                      |
| `400 Bad Request`            | The body has a field other than the three accepted                                                                             | `{ "message": "Only current_password, new_password and confirm_password are accepted" }`                                                |
| `400 Bad Request`            | `current_password` is missing, not a string or empty                                                                           | `{ "message": "Current password is required" }`                                                                                         |
| `400 Bad Request`            | `new_password` is missing, not a string or does not meet the policy, or Supabase refuses it as weak (`weak_password`)          | `{ "message": "Invalid password: use 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character" }` |
| `400 Bad Request`            | `confirm_password` is missing or differs from `new_password`                                                                   | `{ "message": "Password confirmation does not match" }`                                                                                 |
| `400 Bad Request`            | The new password equals the current one, or Supabase reports `same_password`                                                   | `{ "message": "The new password must be different from the current one" }`                                                              |
| `400 Bad Request`            | The current password is wrong (`invalid_credentials`), or Supabase refuses it during the update (`current_password_invalid`)   | `{ "message": "Current password is incorrect" }`                                                                                        |
| `401 Unauthorized`           | No token                                                                                                                       | `{ "message": "Missing or invalid authorization header" }`                                                                              |
| `401 Unauthorized`           | Invalid, expired or revoked token. A wrong current password is never a `401`                                                   | `{ "message": "Session expired or invalid" }`                                                                                           |
| `403 Forbidden`              | The account is blocked                                                                                                         | `{ "message": "Account blocked" }`                                                                                                      |
| `403 Forbidden`              | Supabase answers `user_banned` or `email_not_confirmed` while verifying the current password                                   | `{ "message": "Account not allowed to log in" }`                                                                                        |
| `404 Not Found`              | Another path under `/api/account`, e.g. `/api/account/Password` (routes are case sensitive)                                    | `{ "message": "Not found" }`                                                                                                            |
| `405 Method Not Allowed`     | Any method other than `POST`, `OPTIONS` and `HEAD` included                                                                    | `{ "message": "Method not allowed" }`                                                                                                   |
| `415 Unsupported Media Type` | `Content-Type` is not `application/json`, or its charset or encoding is not supported                                          | `{ "message": "Content-Type must be application/json" }`                                                                                |
| `429 Too Many Requests`      | Supabase rate limit, in the token check, the password verification or the update                                               | `{ "message": "Too many requests, please try again later" }`                                                                            |
| `500 Internal Server Error`  | Unexpected error, including Supabase asking for reauthentication or for the current password, and any other unknown error code | `{ "status": "error", "message": "Internal server error" }`                                                                             |

## Example

```bash
curl -i -X POST http://localhost:3000/api/account/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"Current123!","new_password":"NewValid123!","confirm_password":"NewValid123!"}'
```

On success `$TOKEN` belongs to a revoked session: the new tokens are only in the `Set-Cookie` header.

## Notes

- **Changes real data.** There is a single Supabase project shared by local dev, previews and production.
- **How the current password is verified:** the endpoint signs in with `signInWithPassword`, using the email of the verified session (never one from the request) and `current_password`. This creates a new session, on which `updateUser` runs: the caller's refresh cookie is sent only to `/api/auth`, so it is not available here. If Supabase returns a different user from the caller, the new session is revoked and the answer is `500`.
- **Current password sent twice:** `updateUser` receives `current_password` together with the new one, as required once the project setting "Require current password when updating" is enabled.
- **Sessions after success:** the caller stays signed in with the new session. Every other session of the user is revoked (`signOut` with scope `others`), the one used to make the request included. The revocation is best effort: if it fails the answer is still `200` and the error goes to Sentry (tag `context: revoke-other-sessions-after-password-change`). `withAuth` verifies tokens with Supabase `getUser`, so this API refuses a token of a revoked session.
- **Sessions after a failure:** the password check creates a session, which is revoked (best effort, scope `local`) when the update is refused (`400`, `429`, tag `revoke-session-after-refused-password-change`) or fails unexpectedly (`500`, tag `revoke-session-after-password-change-error`). The caller's existing session and cookies are left untouched.
- **`400`, never `401`, for a wrong current password:** the frontend treats a `401` as an expired session and logs the user out.
- **Unknown outcome:** if the update call fails without a clear answer from Supabase (for example a network error), the response is `500` and the API does not check whether the password was changed.
- **Cache:** every response produced after `withAuth` accepts the caller has `Cache-Control: no-store`. The `401`, the `403 "Account blocked"` and the `405` do not set it.
- **CSRF:** the `Content-Type: application/json` requirement and the `SameSite=Strict` cookies.
- **Blocked users:** refused with `403` by `withAuth` before any password check. The status is not read again after the verification. This does not stop a direct call to Supabase Auth, see [Change password](../features/change-password.md#security-and-access).
- **Rate limit:** the application has none. Only the limits of Supabase apply. Supabase sees the requests coming from Vercel, so the limit is probably shared with [login](auth-login.md) (not verified).
- **Supabase project settings:** agreed but not yet enabled nor verified, see [Change password](../features/change-password.md#open-decisions). The behavior with them enabled has not been tested.
- **For the frontend (not built yet):** after a `200` the new `expires_at` has to reach the auth store and the other tabs, and requests sent with the old tokens can fail with `401`, see [Change password](../features/change-password.md#open-decisions).
- **Response time:** the target is under 1 second. It has not been measured (estimate with warm functions: 400-650 ms).
- **Sentry and privacy:** [`api/_lib/sentry.ts`](../../api/_lib/sentry.ts) turns off the collection of request bodies, cookies and headers, so passwords and tokens are not reported.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)). The service role key is not used.
- Related: [`POST /api/auth/reset`](auth-reset.md) sets a new password from a recovery link, without the current one.
