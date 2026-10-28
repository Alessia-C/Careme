# `GET /api/auth/me`

Returns the user behind the session cookie (or Bearer token). The frontend calls it on every page load to restore its in-memory session.

|            |                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| **Method** | `GET`                                                                                                           |
| **Path**   | `/api/auth/me`                                                                                                  |
| **Source** | [`api/auth/me.ts`](../../api/auth/me.ts)                                                                        |
| **Auth**   | Supabase user JWT: `Authorization: Bearer <access_token>` header or the `__Host-sb-access-token` session cookie |
| **Status** | Experimental                                                                                                    |

## Parameters

### Path parameters

None.

### Query parameters

None.

### Headers

| Name            | Required                | Description                                                                                         |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `Authorization` | One of header or cookie | `Bearer <access_token>`. Wins over the cookie when both are present                                 |
| `Cookie`        | One of header or cookie | `__Host-sb-access-token=<access_token>` (`sb-access-token` under `vercel dev`), sent by the browser |

## Request body

None.

## Response

### `200 OK`

| Field        | Type                | Description                                                                                       |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| `user.id`    | `string`            | The user's id (`auth.users.id`)                                                                   |
| `user.email` | `string`            | The user's email                                                                                  |
| `user.role`  | `"user" \| "admin"` | Read from `profiles.role`, never from the request                                                 |
| `expires_at` | `number`            | Unix time in seconds when the access token expires, read from the `exp` claim of the verified JWT |

```json
{
  "user": { "id": "5b1c...", "email": "jane@example.com", "role": "user" },
  "expires_at": 1793000000
}
```

Same `user` and `expires_at` fields as the [login](auth-login.md) response; the page uses `expires_at` to schedule [the renewal](auth-refresh.md). The response contains no token and sets no cookie. It is sent with `Cache-Control: no-store`.

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

| Status                      | When                                                                              | Example body                                                 |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `401 Unauthorized`          | No token: header missing, no `Bearer ` prefix or empty token, and no cookie       | `{ "message": "Missing or invalid authorization header" }`   |
| `401 Unauthorized`          | The token is expired, invalid or its session was revoked                          | `{ "message": "Session expired or invalid" }`                |
| `403 Forbidden`             | The profile is `blocked`                                                          | `{ "message": "Account blocked" }`                           |
| `405 Method Not Allowed`    | The method is not `GET`                                                           | `{ "message": "Method not allowed" }`                        |
| `429 Too Many Requests`     | Supabase's request rate limit is exceeded                                         | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error` | An env var is missing or Supabase fails unexpectedly. The error is sent to Sentry | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
# With the header
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"

# With the session cookie saved by /api/auth/login (cookie jar)
curl http://localhost:3000/api/auth/me -b cookies.txt
```

## Notes

- The whole endpoint is [`withAuth`](README.md#conventions): the handler echoes `id`, `email` and `role`, which `withAuth` already has, and decodes `exp` from the token that `withAuth` has just verified (`getTokenExpiry()`; decoding is not a verification). No extra Supabase call is made.
- Read-only `GET` with no side effects, so it needs no CSRF defence; the `SameSite=Strict` cookie is not sent on cross-site requests anyway.
- The frontend treats `401` and `403` as "no session" and anything else (network error, `429`, `5xx`, malformed body) as a failure it cannot interpret: see [Session restore](../features/session-restore.md).
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)).
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
