# `POST /api/products`

Creates a product for the authenticated user. The response tells whether the user already has a product with the same name and brand; the product is created anyway.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `POST`                                                                       |
| **Path**   | `/api/products`                                                              |
| **Source** | [`api/products/_routes/create.ts`](../../api/products/_routes/create.ts)     |
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

| Field      | Type     | Required | Constraints                    | Description                                            |
| ---------- | -------- | -------- | ------------------------------ | ------------------------------------------------------ |
| `name`     | `string` | Yes      | 1–100 chars after trimming     | Product name                                           |
| `brand`    | `string` | Yes      | 1–100 chars after trimming     | Brand name                                             |
| `category` | `string` | Yes      | `skincare` \| `makeup`         | Product category                                       |
| `status`   | `string` | Yes      | `new` \| `used` \| `finished`  | Usage status. Required even if the DB has a default    |
| `note`     | `string` | No       | Up to 500 chars after trimming | Free text. Missing, `null` or blank is saved as `null` |

`name`, `brand` and `note` are trimmed before they are saved. A NUL character (`\u0000`) in any text field is rejected with `400`. Any other field (`id`, `user_id`, `created_at`, …) is ignored: the owner is always the authenticated user.

```json
{
  "name": "Hydrating Cream",
  "brand": "CeraVe",
  "category": "skincare",
  "status": "new",
  "note": "Bought in May"
}
```

## Response

### `201 Created`

| Field         | Type             | Description                                                                            |
| ------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `product`     | `object`         | The created product: `id`, `name`, `brand`, `category`, `status`, `note`, `created_at` |
| `duplicate`   | `boolean`        | `true` if the user already had a product with the same name and brand                  |
| `duplicateOf` | `uuid` \| `null` | Id of the existing product when `duplicate` is `true`, otherwise `null`                |

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
  },
  "duplicate": false,
  "duplicateOf": null
}
```

## Error cases

All errors return JSON shaped `{ "message": string }`.

| Status                       | When                                                              | Example body                                                 |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `400 Bad Request`            | Body missing, malformed or too large, or a field fails validation | `{ "message": "Name is required (max 100 characters)" }`     |
| `401 Unauthorized`           | Missing, invalid, expired or revoked token                        | `{ "message": "Missing or invalid authorization header" }`   |
| `403 Forbidden`              | The account is blocked                                            | `{ "message": "Account blocked" }`                           |
| `405 Method Not Allowed`     | Any method other than `GET` and `POST`                            | `{ "message": "Method not allowed" }`                        |
| `415 Unsupported Media Type` | `Content-Type` is not `application/json`                          | `{ "message": "Content-Type must be application/json" }`     |
| `429 Too Many Requests`      | Supabase rate limit                                               | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error`  | Unexpected server or database error                               | `{ "status": "error", "message": "Internal server error" }`  |

Validation messages: `Name is required (max 100 characters)`, `Brand is required (max 100 characters)`, `Category must be skincare or makeup`, `Status must be new, used or finished`, `Note must be a string`, `Note is too long (max 500 characters)`, `Note contains invalid characters`.

## Example

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hydrating Cream","brand":"CeraVe","category":"skincare","status":"new"}'
```

## Notes

- Runs as the caller (`createUserClient`), so the RLS insert policy applies: `auth.uid() = user_id` and the profile must be `active`. No migration was needed.
- The duplicate check is informative, not atomic: there is no unique constraint, and two concurrent requests can both report `duplicate: false`.
- The comparison is exact on the trimmed values and case sensitive: `CeraVe` and `cerave` are different brands.
- Limits (100/100/500) live in [`shared/products.ts`](../../shared/products.ts) so the frontend form can reuse them.
- The function is `api/products/index.ts`: a catch-all (`[...path].ts`) needs at least one segment, so it would never match `/api/products`. `api/products/[...path].ts` serves the paths with a segment.
- The path also serves `GET` ([`GET /api/products`](products-list.md)) through `withMethods`.
