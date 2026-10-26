# `POST /api/auth/refresh`

Exchanges the refresh cookie for a new session through Supabase Auth and rotates both session cookies. Called by the frontend shortly before the access token expires, see [Session renewal](../features/session-renewal.md).

|            |                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Method** | `POST`                                                                                                                                        |
| **Path**   | `/api/auth/refresh`                                                                                                                           |
| **Source** | [`api/auth/refresh.ts`](../../api/auth/refresh.ts)                                                                                            |
| **Auth**   | The HttpOnly refresh cookie (`__Secure-sb-refresh-token`, `sb-refresh-token` under `vercel dev`). No `Authorization` header and no `withAuth` |
| **Status** | Experimental                                                                                                                                  |

## Parameters

### Path parameters

None.

### Query parameters

None.

### Headers

| Name           | Required | Description                                                                                      |
| -------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `Cookie`       | Yes      | The refresh cookie, sent by the browser. It is only sent to paths under `/api/auth` (its `Path`) |
| `Content-Type` | Yes      | Must start with `application/json`, otherwise `415`. CSRF defence, see Notes                     |

## Request body

A JSON object is required, but its content is ignored. Send `{}`. A missing body or a body that is not an object (array, string, `null`) is answered with `400`.

## Response

### `200 OK`

| Field        | Type     | Description                                                      |
| ------------ | -------- | ---------------------------------------------------------------- |
| `expires_at` | `number` | Unix time in seconds when the new access token stops being valid |

```json
{
  "expires_at": 1793000000
}
```

The body contains no token. Both tokens travel in a single `Set-Cookie` header (an array of two cookies), which replaces the previous ones:

| Cookie                                                                              | Attributes                                                           |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `__Host-sb-access-token=<access_token>` (`sb-access-token` under `vercel dev`)      | `HttpOnly; SameSite=Strict; Path=/; Max-Age=<expires_in>; Secure`    |
| `__Secure-sb-refresh-token=<refresh_token>` (`sb-refresh-token` under `vercel dev`) | `HttpOnly; SameSite=Strict; Path=/api/auth; Secure` (session cookie) |

`Secure` is omitted when `VERCEL_ENV` is `development`. The response is sent with `Cache-Control: no-store`.

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`. `Cache-Control: no-store` is set on every response produced by the handler.

| Status                       | When                                                                                                                                                                                                                   | Cookies      | Example body                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `401 Unauthorized`           | The refresh cookie is missing or empty                                                                                                                                                                                 | Both cleared | `{ "message": "Missing refresh token" }`                     |
| `401 Unauthorized`           | Supabase rejects the refresh token as unknown, already used or revoked (auth error status 401, 403 or 404, or status 400 with the code `refresh_token_not_found`, `refresh_token_already_used` or `session_not_found`) | Both cleared | `{ "message": "Session expired or invalid" }`                |
| `403 Forbidden`              | The refresh succeeded but the profile is `blocked`. The new session is discarded and revoked on Supabase (best effort)                                                                                                 | Both cleared | `{ "message": "Account blocked" }`                           |
| `405 Method Not Allowed`     | The method is not `POST`                                                                                                                                                                                               | Untouched    | `{ "message": "Method not allowed" }`                        |
| `415 Unsupported Media Type` | The `Content-Type` is missing or does not start with `application/json`                                                                                                                                                | Untouched    | `{ "message": "Content-Type must be application/json" }`     |
| `400 Bad Request`            | The body is missing or is not a JSON object                                                                                                                                                                            | Untouched    | `{ "message": "Missing or invalid request body" }`           |
| `429 Too Many Requests`      | Supabase's request rate limit is exceeded                                                                                                                                                                              | Untouched    | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error`  | An env var is missing, Supabase fails (5xx, network), returns no session, or the status check fails. Sent to Sentry                                                                                                    | Untouched    | `{ "status": "error", "message": "Internal server error" }`  |

"Cleared" means `Set-Cookie` deletes both cookies (same name, `Path` and attributes, empty value, `Max-Age=0`), so the browser stops sending them. They are left untouched on `429` and `500` because the refresh token may still be valid and the page retries.

## Example

```bash
# Cookie jar saved by /api/auth/login (the refresh cookie has Path=/api/auth)
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" -d '{}' \
  -b cookies.txt -c cookies.txt
```

## Notes

- **Rotation:** Supabase invalidates the refresh token as soon as the call succeeds, so the new one must reach the browser. Both cookies are set in one `Set-Cookie` header with an array value, because a second `setHeader` call with the same name would replace the first (`setSessionCookies()` in [`api/_lib/auth.ts`](../../api/_lib/auth.ts)). A refresh token reused by a second request (for example from two tabs at once) is refused by Supabase and answered with `401`.
- **Refresh cookie:** `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, no `Max-Age` (a session cookie). Supabase refresh tokens do not expire by themselves, so a cookie that outlived the browser would leave a usable session on a shared device. The `__Host-` prefix needs `Path=/`, so the refresh cookie uses `__Secure-` (production); under `vercel dev` (plain http) it is `sb-refresh-token` without `Secure`. The narrow `Path` means it is never sent to other endpoints.
- **Blocked users:** the endpoint calls `is_active()` with the new JWT (RLS applies) before setting any cookie. A blocked user therefore never receives a new session and loses the cookies. Anything but an explicit `true` counts as blocked.
- **CSRF:** the endpoint is wrapped in `withObjectBody`, which requires a JSON `Content-Type` and an object body (the body is then ignored). A cross-site `<form>` cannot send `application/json` without a CORS preflight. `SameSite=Strict` also keeps the cookie out of cross-site requests.
- **No `withAuth`:** the access token may already have expired when the page renews late, so the endpoint authenticates with the refresh token only.
- **Client mapping:** `refreshSession()` in [`src/lib/authApi.ts`](../../src/lib/authApi.ts) treats `401` and `403` as "session gone" and everything else (network error, `429`, `5xx`, malformed body) as a transient failure.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)). The service role key is not used.
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
