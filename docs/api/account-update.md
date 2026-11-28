# `PUT /api/account`

Updates the first and last name of the authenticated user. Both names are sent every time. Nothing else can be changed here.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `PUT`                                                                        |
| **Path**   | `/api/account`                                                               |
| **Source** | [`api/account/_routes/update.ts`](../../api/account/_routes/update.ts)       |
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
| `Content-Type`  | Yes      | `application/json`                                             |

## Request body

`Content-Type: application/json`, at most 10 KB.

| Field        | Type     | Required | Constraints                       | Description |
| ------------ | -------- | -------- | --------------------------------- | ----------- |
| `first_name` | `string` | Yes      | 1–50 chars after trimming, no NUL | First name  |
| `last_name`  | `string` | Yes      | 1–50 chars after trimming, no NUL | Last name   |

Both names are trimmed before they are saved. **Any other field is refused** with `400`, including `email`, `role`, `status` and `id`, and nothing is written.

```json
{
  "first_name": "Anna",
  "last_name": "Rossi"
}
```

## Response

### `200 OK`

The response has `Cache-Control: no-store`.

| Field                | Type     | Description            |
| -------------------- | -------- | ---------------------- |
| `account.first_name` | `string` | The saved first name   |
| `account.last_name`  | `string` | The saved last name    |
| `account.email`      | `string` | Login email, unchanged |

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

| Status                       | When                                                | Example body                                                    |
| ---------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `400 Bad Request`            | Body missing, not an object, malformed or too large | `{ "message": "Missing or invalid request body" }`              |
| `400 Bad Request`            | The body has a field other than the two names       | `{ "message": "Only first_name and last_name can be updated" }` |
| `400 Bad Request`            | A name is missing or invalid                        | `{ "message": "First name is required (max 50 characters)" }`   |
| `401 Unauthorized`           | Missing, invalid, expired or revoked token          | `{ "message": "Missing or invalid authorization header" }`      |
| `403 Forbidden`              | The account is blocked                              | `{ "message": "Account blocked" }`                              |
| `404 Not Found`              | The profile of the caller was not updated           | `{ "message": "Account not found" }`                            |
| `405 Method Not Allowed`     | Any method other than `GET` and `PUT`               | `{ "message": "Method not allowed" }`                           |
| `415 Unsupported Media Type` | `Content-Type` is not `application/json`            | `{ "message": "Content-Type must be application/json" }`        |
| `429 Too Many Requests`      | Supabase rate limit                                 | `{ "message": "Too many requests, please try again later" }`    |
| `500 Internal Server Error`  | Unexpected server or database error                 | `{ "status": "error", "message": "Internal server error" }`     |

## Example

```bash
curl -X PUT http://localhost:3000/api/account \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Anna","last_name":"Rossi"}'
```

## Notes

- **Changes real data.** There is a single Supabase project shared by local dev, previews and production.
- Runs as the caller (`createUserClient`), so the RLS update policy applies (`using`: `auth.uid() = id` and an active profile). The query also filters the `id` of the verified session.
- `role` and `status` are protected twice: the API writes only the two names, and the `prevent_privilege_change` trigger blocks non-admins in the database.
- The 50 character limit is also a check constraint on `profiles` (migration `20261125090000_add_profiles_name_checks.sql`).
- The call is idempotent: sending the current names again answers `200`.
- Only `profiles` is updated: the `first_name` and `last_name` in the Supabase Auth user metadata keep the values given at signup.
