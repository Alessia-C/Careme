# `GET /api/products/:id`

Returns one product of the authenticated user, with its note.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `GET`                                                                        |
| **Path**   | `/api/products/:id`                                                          |
| **Source** | [`api/products/_routes/detail.ts`](../../api/products/_routes/detail.ts)     |
| **Auth**   | Supabase user JWT (`Authorization: Bearer <access_token>` or session cookie) |
| **Status** | Stable                                                                       |

## Parameters

### Path parameters

| Name | Type   | Description       |
| ---- | ------ | ----------------- |
| `id` | `uuid` | Id of the product |

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

| Field     | Type     | Description                                                                            |
| --------- | -------- | -------------------------------------------------------------------------------------- |
| `product` | `object` | `id`, `name`, `brand`, `category`, `status`, `note` (`string` or `null`), `created_at` |

```json
{
  "product": {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Hydrating Cream",
    "brand": "CeraVe",
    "category": "skincare",
    "status": "new",
    "note": "Bought in May",
    "created_at": "2026-10-31T10:00:00Z"
  }
}
```

## Error cases

All errors return JSON shaped `{ "message": string }`.

| Status                      | When                                                                            | Example body                                                 |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `401 Unauthorized`          | Missing, invalid, expired or revoked token                                      | `{ "message": "Missing or invalid authorization header" }`   |
| `403 Forbidden`             | The account is blocked                                                          | `{ "message": "Account blocked" }`                           |
| `404 Not Found`             | The id is not a uuid, the product does not exist, or it belongs to another user | `{ "message": "Product not found" }`                         |
| `405 Method Not Allowed`    | Any method other than `GET` and `PUT`                                           | `{ "message": "Method not allowed" }`                        |
| `429 Too Many Requests`     | Supabase rate limit                                                             | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error` | Unexpected server or database error                                             | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
curl http://localhost:3000/api/products/00000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $TOKEN"
```

## Notes

- Runs as the caller (`createUserClient`), so the RLS select policy applies. The query also filters `user_id` explicitly.
- The three `404` cases have the same answer on purpose: the response never tells whether an id exists for someone else. A malformed id is answered without calling the database, because Postgres would fail on it.
- The path also serves `PUT` ([`PUT /api/products/:id`](products-update.md)) through `withMethods`.
- The function is [`api/products/[...path].ts`](../../api/products/[...path].ts), next to `index.ts` which serves `/api/products`.
