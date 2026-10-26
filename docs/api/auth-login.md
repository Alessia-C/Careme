# `POST /api/auth/login`

Authenticates a user through Supabase Auth and sets the session in two HttpOnly cookies (access and refresh token). Rejects blocked accounts. Called by the login form of the frontend.

|            |                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| **Method** | `POST`                                                                                                           |
| **Path**   | `/api/auth/login`                                                                                                |
| **Source** | [`api/auth/login.ts`](../../api/auth/login.ts)                                                                   |
| **Auth**   | None (public endpoint, it uses the Supabase anon key). It issues the session cookies used by protected endpoints |
| **Status** | Experimental                                                                                                     |

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

| Field      | Type     | Required | Constraints                                           | Description     |
| ---------- | -------- | -------- | ----------------------------------------------------- | --------------- |
| `email`    | `string` | Yes      | Valid email format. Trimmed and lowercased before use | Login email     |
| `password` | `string` | Yes      | Any string (verified by Supabase, not by the policy)  | User's password |

```json
{
  "email": "anna.rossi@example.com",
  "password": "Valid123!"
}
```

## Response

### `200 OK`

| Field        | Type     | Description                                                                                                                                      |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `message`    | `string` | Always `"Login successful"`                                                                                                                      |
| `user.id`    | `string` | User id (same as `profiles.id`)                                                                                                                  |
| `user.email` | `string` | User email                                                                                                                                       |
| `user.role`  | `string` | `user` or `admin`. A UI hint only, see Notes                                                                                                     |
| `expires_at` | `number` | Unix time in seconds when the access token expires. The page uses it to renew the session, see [Session renewal](../features/session-renewal.md) |

The body contains no `session` and no tokens. Both tokens are sent only in one `Set-Cookie` header (an array of two cookies):

| Cookie                                                                              | Attributes                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `__Host-sb-access-token=<access_token>` (`sb-access-token` under `vercel dev`)      | `HttpOnly; SameSite=Strict; Path=/; Max-Age=<expires_in>; Secure`   |
| `__Secure-sb-refresh-token=<refresh_token>` (`sb-refresh-token` under `vercel dev`) | `HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=604800; Secure` |

The access token `Max-Age` is its lifetime in seconds (`expires_in`); the refresh cookie lasts 7 days. `Secure` is omitted when `VERCEL_ENV` is `development` (`vercel dev` serves plain http).

```json
{
  "message": "Login successful",
  "user": {
    "id": "0b6c...",
    "email": "anna.rossi@example.com",
    "role": "user"
  },
  "expires_at": 1793000000
}
```

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

| Status                       | When                                                                                                   | Example body                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `400 Bad Request`            | The body is missing or is not a JSON object                                                            | `{ "message": "Missing or invalid request body" }`           |
| `400 Bad Request`            | `email` or `password` is missing or not a string                                                       | `{ "message": "Email and password are required" }`           |
| `400 Bad Request`            | `email` is not a valid email                                                                           | `{ "message": "Invalid email" }`                             |
| `400 Bad Request`            | Wrong email or password. The message is generic on purpose, see Notes                                  | `{ "message": "Invalid email or password" }`                 |
| `403 Forbidden`              | The profile is `blocked`                                                                               | `{ "message": "Account blocked" }`                           |
| `403 Forbidden`              | Supabase reports a banned user or an unconfirmed email (only after valid credentials)                  | `{ "message": "Account not allowed to log in" }`             |
| `405 Method Not Allowed`     | The method is not `POST`                                                                               | `{ "message": "Method not allowed" }`                        |
| `415 Unsupported Media Type` | The `Content-Type` is not `application/json` (blocks cross-site form posts, see Notes)                 | `{ "message": "Content-Type must be application/json" }`     |
| `429 Too Many Requests`      | Supabase's request rate limit is exceeded                                                              | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error`  | An env var is missing, or Supabase or the status check or role read fails. The error is sent to Sentry | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"anna.rossi@example.com","password":"Valid123!"}'
```

## Notes

- **Session cookies:** the access token is set as the `__Host-sb-access-token` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age` = `expires_in`), built by `buildSessionCookie()` in [`api/_lib/auth.ts`](../../api/_lib/auth.ts). Scripts on the page cannot read it, which limits the impact of XSS. The refresh token is set as a second cookie, see below. No cookie is set on any error response.
- **Refresh token:** set as the `__Secure-sb-refresh-token` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`, `Max-Age` 7 days; `sb-refresh-token` under `vercel dev`) and never returned in the body. It is sent only to `/api/auth/*` and is used by [`/api/auth/refresh`](auth-refresh.md) to renew the session.
- **Protected endpoints:** `withAuth` accepts the token from the `Authorization: Bearer` header (which has priority) or from this cookie. API clients such as curl can keep using the header, but they now have to take the token from the `Set-Cookie` header, since it is no longer in the body.
- **CSRF:** because the browser now sends credentials automatically, cross-site request forgery is mitigated by `SameSite=Strict`: the cookie is not sent on cross-site requests. There is no CSRF token. Requests must stay same-site, and state-changing endpoints must not use `GET`.
- **Logout:** [`/api/auth/logout`](auth-logout.md) reads the token from this cookie (or the header), revokes the session and deletes both cookies with `Max-Age=0`.
- **Generic credentials error:** unknown email and wrong password return the same `400`, so the endpoint does not reveal which emails are registered.
- **Blocked users:** Supabase Auth ignores `profiles.status` and issues a token anyway. The endpoint then calls the `is_active()` database function with the new token (RLS applies) and returns `403` without the tokens when the profile is not active. Existing sessions of a user blocked later stay valid until the access token expires, and the refresh token works until [`/api/auth/refresh`](auth-refresh.md) is called, which then answers `403` and clears the cookies. RLS blocks their data access in the meantime. See the DoS note in the project docs for the planned ban and session revocation.
- **Role:** read from `profiles.role` with the caller's JWT (RLS applies). The client can use it to show or hide UI, but it is never an authorization: the API and RLS check the role in the database on every request. An unexpected value makes the endpoint return `500` instead of passing it on.
- **Cookie name and CSRF:** the cookie is named `__Host-sb-access-token` (browsers reject a `__Host-` cookie set with a wider `Domain`, which prevents cookie tossing from sibling subdomains). Under `vercel dev` (plain http) it is `sb-access-token` without `Secure`. Because `SameSite` does not stop a cross-site request from _setting_ a cookie, the endpoint accepts only `Content-Type: application/json` (`415` otherwise): a cross-site HTML form cannot send it without a CORS preflight, so it cannot log a victim into the attacker's account.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)). The service role key is not used.
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
