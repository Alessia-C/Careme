# `DELETE /api/products/:id`

Deletes one product of the authenticated user. The deletion is permanent: there is no soft delete and no undo.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `DELETE`                                                                     |
| **Path**   | `/api/products/:id`                                                          |
| **Source** | [`api/products/_routes/remove.ts`](../../api/products/_routes/remove.ts)     |
| **Auth**   | Supabase user JWT (`Authorization: Bearer <access_token>` or session cookie) |
| **Status** | Stable                                                                       |

## Parameters

### Path parameters

| Name | Type   | Required | Description                                              |
| ---- | ------ | -------- | -------------------------------------------------------- |
| `id` | `uuid` | Yes      | Id of the product. A value that is not a uuid is a `404` |

### Query parameters

None

### Headers

| Name            | Required | Description                                                    |
| --------------- | -------- | -------------------------------------------------------------- |
| `Authorization` | No       | `Bearer <access_token>`. Without it the session cookie is used |

## Request body

None

## Response

### `204 No Content`

The product was deleted. The response has no body.

## Error cases

All errors return JSON shaped `{ "message": string }`.

| Status                      | When                                                                            | Example body                                                 |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `401 Unauthorized`          | Missing, invalid, expired or revoked token                                      | `{ "message": "Missing or invalid authorization header" }`   |
| `403 Forbidden`             | The account is blocked                                                          | `{ "message": "Account blocked" }`                           |
| `404 Not Found`             | The id is not a uuid, the product does not exist, or it belongs to another user | `{ "message": "Product not found" }`                         |
| `405 Method Not Allowed`    | Any method other than `GET`, `PUT` and `DELETE`                                 | `{ "message": "Method not allowed" }`                        |
| `429 Too Many Requests`     | Supabase rate limit                                                             | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error` | Unexpected server or database error                                             | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
curl -X DELETE http://localhost:3000/api/products/00000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $TOKEN"
```

## Notes

- Runs as the caller (`createUserClient`), so the RLS delete policy applies (`auth.uid() = user_id` and an active profile). The query also filters `id` and `user_id` explicitly. No migration was needed.
- A delete that matches no row is not an error for Postgres, so the query asks for the removed row back (`select('id')`): no row means the product is missing or belongs to someone else.
- Because of `select('id')`, Postgres needs the RLS select policy too: the returned row must be readable by the caller. Migrations that touch the policies of `products` must keep the SELECT and DELETE policies aligned, otherwise a delete that works could be answered as `404` (or fail).
- The three `404` cases have the same answer on purpose: the response never tells whether an id exists for someone else. A malformed id is answered without calling the database, because Postgres would fail on it.
- Not idempotent in its status code: a second `DELETE` on the same id answers `404`, because the product no longer exists. The first one answers `204`.
- The path also serves `GET` ([`GET /api/products/:id`](products-detail.md)) and `PUT` ([`PUT /api/products/:id`](products-update.md)) through `withMethods`.
