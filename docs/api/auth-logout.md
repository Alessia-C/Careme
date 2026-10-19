# `POST /api/auth/logout`

Revokes the caller's current session through Supabase Auth. Called by the frontend when the user logs out.

|            |                                                            |
| ---------- | ---------------------------------------------------------- |
| **Method** | `POST`                                                     |
| **Path**   | `/api/auth/logout`                                         |
| **Source** | [`api/auth/logout.ts`](../../api/auth/logout.ts)           |
| **Auth**   | Supabase user JWT (`Authorization: Bearer <access_token>`) |
| **Status** | Experimental                                               |

## Parameters

### Path parameters

None.

### Query parameters

None.

### Headers

| Name            | Required | Description             |
| --------------- | -------- | ----------------------- |
| `Authorization` | Yes      | `Bearer <access_token>` |

## Request body

None.

## Response

### `200 OK`

| Field     | Type     | Description                        |
| --------- | -------- | ---------------------------------- |
| `message` | `string` | Always `"Logged out successfully"` |

```json
{
  "message": "Logged out successfully"
}
```

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

| Status                      | When                                                                                 | Example body                                                 |
| --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `401 Unauthorized`          | The `Authorization` header is missing, has no `Bearer ` prefix or has an empty token | `{ "message": "Missing or invalid authorization header" }`   |
| `401 Unauthorized`          | The token is expired, invalid or its session was already revoked. See Notes          | `{ "message": "Session expired or invalid" }`                |
| `405 Method Not Allowed`    | The method is not `POST`                                                             | `{ "message": "Method not allowed" }`                        |
| `429 Too Many Requests`     | Supabase's request rate limit is exceeded                                            | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error` | An env var is missing or Supabase fails unexpectedly. The error is sent to Sentry    | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Notes

- **Client behavior on `401`:** the session is no longer valid, so the client must drop its local session and redirect the user to the login page. The endpoint does not redirect: it only answers with the status.
- **Scope:** only the session of the token sent is revoked (`local`), not the user's sessions on other devices.
- **Blocked users:** the endpoint does not use the shared `withAuth` middleware, so a `blocked` user can still log out and have their session revoked. Frontends should call it when any protected endpoint answers `403` with `Account blocked`.
- **Repeated logout:** calling it again with the same token returns `401`, because the session no longer exists.
- **Session expiry (60 minutes):** the Supabase access token expires after 3600 seconds (Auth settings) and a protected endpoint rejects an expired token with `401`. Supabase's server-side inactivity timeout is not configurable on the current plan, so the 60-minute inactivity policy is handled by the frontend: it must refresh the session only while the user is active and log out (calling this endpoint, then going to the login) when the user has been inactive for 60 minutes.
- **No service role key:** the endpoint forwards the caller's own JWT to Supabase Auth, using the anon client.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)).
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
