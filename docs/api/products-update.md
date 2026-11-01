# `PUT /api/products/:id`

Replaces the data of one product of the authenticated user and returns the updated product. It takes the same fields as [`POST /api/products`](products-create.md): the whole product is sent, not only what changed.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `PUT`                                                                        |
| **Path**   | `/api/products/:id`                                                          |
| **Source** | [`api/products/_routes/update.ts`](../../api/products/_routes/update.ts)     |
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
| `Content-Type`  | Yes      | `application/json`                                             |

## Request body

`Content-Type: application/json`, at most 10 KB.

| Field      | Type     | Required | Constraints                    | Description                                             |
| ---------- | -------- | -------- | ------------------------------ | ------------------------------------------------------- |
| `name`     | `string` | Yes      | 1–100 chars after trimming     | Product name                                            |
| `brand`    | `string` | Yes      | 1–100 chars after trimming     | Brand name. An empty or blank brand is rejected         |
| `category` | `string` | Yes      | `skincare` \| `makeup`         | Product category                                        |
| `status`   | `string` | Yes      | `new` \| `used` \| `finished`  | Usage status                                            |
| `note`     | `string` | No       | Up to 500 chars after trimming | Free text. Missing, `null` or blank clears the old note |

The validation is the same as in [`POST /api/products`](products-create.md). `name`, `brand` and `note` are trimmed before they are saved. A NUL character (`\u0000`) in any text field is rejected with `400`. Any other field (`id`, `user_id`, `created_at`, …) is ignored: the id comes from the path and the owner never changes.

```json
{
  "name": "Hydrating Cream",
  "brand": "CeraVe",
  "category": "skincare",
  "status": "used",
  "note": "Bought in May"
}
```

## Response

### `200 OK`

| Field     | Type     | Description                                                                            |
| --------- | -------- | -------------------------------------------------------------------------------------- |
| `product` | `object` | The updated product: `id`, `name`, `brand`, `category`, `status`, `note`, `created_at` |

```json
{
  "product": {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Hydrating Cream",
    "brand": "CeraVe",
    "category": "skincare",
    "status": "used",
    "note": "Bought in May",
    "created_at": "2026-10-31T10:00:00Z"
  }
}
```

## Error cases

All errors return JSON shaped `{ "message": string }`.

| Status                       | When                                                                            | Example body                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `400 Bad Request`            | Body missing, malformed or too large, or a field fails validation               | `{ "message": "Brand is required (max 100 characters)" }`    |
| `401 Unauthorized`           | Missing, invalid, expired or revoked token                                      | `{ "message": "Missing or invalid authorization header" }`   |
| `403 Forbidden`              | The account is blocked                                                          | `{ "message": "Account blocked" }`                           |
| `404 Not Found`              | The id is not a uuid, the product does not exist, or it belongs to another user | `{ "message": "Product not found" }`                         |
| `405 Method Not Allowed`     | Any method other than `GET` and `PUT`                                           | `{ "message": "Method not allowed" }`                        |
| `415 Unsupported Media Type` | `Content-Type` is not `application/json`                                        | `{ "message": "Content-Type must be application/json" }`     |
| `429 Too Many Requests`      | Supabase rate limit                                                             | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error`  | Unexpected server or database error                                             | `{ "status": "error", "message": "Internal server error" }`  |

Validation messages are the ones of [`POST /api/products`](products-create.md#error-cases). The id is checked before the body: a malformed id is a `404` even if the body is also invalid.

## Example

```bash
curl -X PUT http://localhost:3000/api/products/00000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hydrating Cream","brand":"CeraVe","category":"skincare","status":"used"}'
```

## Notes

- Runs as the caller (`createUserClient`), so the RLS update policy applies (`using`: `auth.uid() = user_id` and an active profile; `with check`: `auth.uid() = user_id`). The query also filters `id` and `user_id` explicitly. No migration was needed.
- One query does the whole work: when no row is updated the product is missing or belongs to someone else, and both answer the same `404`, so the response never tells whether an id exists for someone else.
- Sending the current values again is not an error: the answer is `200` with the product, so the call is idempotent. There is no `updated_at` column.
- There is no duplicate check: unlike `POST /api/products`, the response has no `duplicate` or `duplicateOf` fields, and a name and brand equal to another product are accepted.
- The validation lives in [`api/products/_validation.ts`](../../api/products/_validation.ts), shared with create. It may move to `shared/` when the frontend form needs it.
- The same path serves `GET` ([`GET /api/products/:id`](products-detail.md)) through `withMethods`.
