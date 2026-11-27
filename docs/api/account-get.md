# `GET /api/account`

Returns the profile data of the authenticated user: first name, last name and email. Meant for the account page of the frontend, which does not exist yet.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `GET`                                                                        |
| **Path**   | `/api/account`                                                               |
| **Source** | [`api/account/_routes/get.ts`](../../api/account/_routes/get.ts)             |
| **Auth**   | Supabase user JWT (`Authorization: Bearer <access_token>` or session cookie) |
| **Status** | Stable                                                                       |

## Parameters

### Path parameters

None

### Query parameters

None

### Headers

| Name            | Required | Description                                                    |
| --------------- | -------- | -------------------------------------------------------------- |
| `Authorization` | No       | `Bearer <access_token>`. Without it the session cookie is used |

## Request body

None

## Response

### `200 OK`

The response has `Cache-Control: no-store`.

| Field                | Type     | Description                              |
| -------------------- | -------- | ---------------------------------------- |
| `account.first_name` | `string` | First name, `""` if the profile has none |
| `account.last_name`  | `string` | Last name, `""` if the profile has none  |
| `account.email`      | `string` | Login email. Read-only                   |

```json
{
  "account": {
    "first_name": "Anna",
    "last_name": "Rossi",
    "email": "anna.rossi@example.com"
  }
}
```

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

| Status                      | When                                       | Example body                                                 |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `401 Unauthorized`          | Missing, invalid, expired or revoked token | `{ "message": "Missing or invalid authorization header" }`   |
| `403 Forbidden`             | The account is blocked                     | `{ "message": "Account blocked" }`                           |
| `405 Method Not Allowed`    | Any method other than `GET` and `PUT`      | `{ "message": "Method not allowed" }`                        |
| `429 Too Many Requests`     | Supabase rate limit                        | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error` | Unexpected server or database error        | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
curl http://localhost:3000/api/account \
  -H "Authorization: Bearer $TOKEN"
```

## Notes

- The names are the ones [`withAuth`](../../api/_lib/auth.ts) reads from `profiles` with the caller's JWT, so RLS applies and no second query is made.
- The email comes from the verified Supabase session: `profiles` has no email column.
- [`GET /api/auth/me`](auth-me.md) also returns these fields, together with the id, role and session expiry.
