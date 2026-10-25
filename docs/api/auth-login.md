# `POST /api/auth/login`

Authenticates a user through Supabase Auth and sets the session in an HttpOnly cookie. Rejects blocked accounts. Called by the login form of the frontend.

|            |                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| **Method** | `POST`                                                                                                          |
| **Path**   | `/api/auth/login`                                                                                               |
| **Source** | [`api/auth/login.ts`](../../api/auth/login.ts)                                                                  |
| **Auth**   | None (public endpoint, it uses the Supabase anon key). It issues the session cookie used by protected endpoints |
| **Status** | Experimental                                                                                                    |

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

| Field        | Type     | Description                                  |
| ------------ | -------- | -------------------------------------------- |
| `message`    | `string` | Always `"Login successful"`                  |
| `user.id`    | `string` | User id (same as `profiles.id`)              |
| `user.email` | `string` | User email                                   |
| `user.role`  | `string` | `user` or `admin`. A UI hint only, see Notes |

The body contains no `session` and no tokens. The access token is sent only in the `Set-Cookie` header:

| Header       | Value                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `Set-Cookie` | `sb-access-token=<access_token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=<expires_in>; Secure` |

`Max-Age` is the token lifetime in seconds (`expires_in`). `Secure` is omitted when `VERCEL_ENV` is `development` (`vercel dev` serves plain http).

```json
{
  "message": "Login successful",
  "user": {
    "id": "0b6c...",
    "email": "anna.rossi@example.com",
    "role": "user"
  }
}
```

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

| Status                      | When                                                                                                   | Example body                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `400 Bad Request`           | The body is missing or is not a JSON object                                                            | `{ "message": "Missing or invalid request body" }`           |
| `400 Bad Request`           | `email` or `password` is missing or not a string                                                       | `{ "message": "Email and password are required" }`           |
| `400 Bad Request`           | `email` is not a valid email                                                                           | `{ "message": "Invalid email" }`                             |
| `400 Bad Request`           | Wrong email or password. The message is generic on purpose, see Notes                                  | `{ "message": "Invalid email or password" }`                 |
| `403 Forbidden`             | The profile is `blocked`                                                                               | `{ "message": "Account blocked" }`                           |
| `403 Forbidden`             | Supabase reports a banned user or an unconfirmed email (only after valid credentials)                  | `{ "message": "Account not allowed to log in" }`             |
| `405 Method Not Allowed`    | The method is not `POST`                                                                               | `{ "message": "Method not allowed" }`                        |
| `429 Too Many Requests`     | Supabase's request rate limit is exceeded                                                              | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error` | An env var is missing, or Supabase or the status check or role read fails. The error is sent to Sentry | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"anna.rossi@example.com","password":"Valid123!"}'
```

## Notes

- **Session cookie:** the access token is set as the `sb-access-token` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age` = `expires_in`), built by `buildSessionCookie()` in [`api/_lib/auth.ts`](../../api/_lib/auth.ts). Scripts on the page cannot read it, which limits the impact of XSS. No cookie is set on any error response.
- **Refresh token:** it is neither stored nor returned. When the access token expires the user has to log in again until refresh is implemented.
- **Protected endpoints:** `withAuth` accepts the token from the `Authorization: Bearer` header (which has priority) or from this cookie. API clients such as curl can keep using the header, but they now have to take the token from the `Set-Cookie` header, since it is no longer in the body.
- **CSRF:** because the browser now sends credentials automatically, cross-site request forgery is mitigated by `SameSite=Strict`: the cookie is not sent on cross-site requests. There is no CSRF token. Requests must stay same-site, and state-changing endpoints must not use `GET`.
- **Logout:** the cookie is not cleared by any endpoint yet, and `/api/auth/logout` still accepts only the `Authorization: Bearer` header (planned for a later issue).
- **Generic credentials error:** unknown email and wrong password return the same `400`, so the endpoint does not reveal which emails are registered.
- **Blocked users:** Supabase Auth ignores `profiles.status` and issues a token anyway. The endpoint then calls the `is_active()` database function with the new token (RLS applies) and returns `403` without the tokens when the profile is not active. Existing sessions of a user blocked later stay valid until the access token expires, and the refresh token keeps working: RLS still blocks their data access. See the DoS note in the project docs for the planned ban and session revocation.
- **Role:** read from `profiles.role` with the caller's JWT (RLS applies). The client can use it to show or hide UI, but it is never an authorization: the API and RLS check the role in the database on every request. An unexpected value makes the endpoint return `500` instead of passing it on.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)). The service role key is not used.
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
