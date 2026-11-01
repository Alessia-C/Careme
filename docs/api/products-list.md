# `GET /api/products`

Lists the products of the authenticated user, newest first, with optional search and category filter and pagination. Products of other users are never returned.

|            |                                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| **Method** | `GET`                                                                        |
| **Path**   | `/api/products`                                                              |
| **Source** | [`api/products/_routes/list.ts`](../../api/products/_routes/list.ts)         |
| **Auth**   | Supabase user JWT (`Authorization: Bearer <access_token>` or session cookie) |
| **Status** | Stable                                                                       |

## Parameters

### Path parameters

None

### Query parameters

All optional. Each one must appear at most once: a repeated parameter (`?search=a&search=b`) is a `400`.

| Name       | Type     | Default | Constraints                     | Description                                                                                                      |
| ---------- | -------- | ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `search`   | `string` | none    | Up to 100 chars after trimming  | Text contained in the `name` (case insensitive) or in the `brand` (case sensitive). Blank is the same as missing |
| `category` | `string` | `all`   | `skincare` \| `makeup` \| `all` | Filters by category. `all` and a missing value mean no filter                                                    |
| `limit`    | `number` | `10`    | Integer from 1 to 20            | Page size                                                                                                        |
| `offset`   | `number` | `0`     | Integer from 0 to 999999999     | Number of products to skip                                                                                       |

`search` is trimmed and cannot contain `%`, `_`, `\`, `*`, `"`, `,`, `(`, `)` or a NUL character: they are wildcards or syntax of the database filter, and are rejected with `400` instead of escaped.

### Headers

| Name            | Required | Description                                                    |
| --------------- | -------- | -------------------------------------------------------------- |
| `Authorization` | No       | `Bearer <access_token>`. Without it the session cookie is used |

## Request body

None

## Response

### `200 OK`

| Field      | Type       | Description                                                                     |
| ---------- | ---------- | ------------------------------------------------------------------------------- |
| `products` | `object[]` | The page: `id`, `name`, `brand`, `category`, `status`, `created_at`. No `note`  |
| `total`    | `number`   | Products that match `search` and `category`, regardless of `limit` and `offset` |

Sorted by `created_at` descending, then `id` descending. A page past the end, or no match, is `200` with `"products": []`.

```json
{
  "products": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "name": "Hydrating Cream",
      "brand": "CeraVe",
      "category": "skincare",
      "status": "new",
      "created_at": "2026-10-31T10:00:00Z"
    }
  ],
  "total": 1
}
```

## Error cases

All errors return JSON shaped `{ "message": string }`.

| Status                      | When                                       | Example body                                                 |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `400 Bad Request`           | A query parameter fails validation         | `{ "message": "Limit must be between 1 and 20" }`            |
| `401 Unauthorized`          | Missing, invalid, expired or revoked token | `{ "message": "Missing or invalid authorization header" }`   |
| `403 Forbidden`             | The account is blocked                     | `{ "message": "Account blocked" }`                           |
| `405 Method Not Allowed`    | Any method other than `GET` and `POST`     | `{ "message": "Method not allowed" }`                        |
| `429 Too Many Requests`     | Supabase rate limit                        | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error` | Unexpected server or database error        | `{ "status": "error", "message": "Internal server error" }`  |

Validation messages: `Limit must be between 1 and 20`, `Offset must be a non-negative integer`, `Category must be skincare, makeup or all`, `Search must be a string`, `Search is too long (max 100 characters)`, `Search contains invalid characters`.

## Example

```bash
curl "http://localhost:3000/api/products?search=cream&category=skincare&limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

## Notes

- Runs as the caller (`createUserClient`), so the RLS select policy applies (`auth.uid() = user_id` and an `active` profile). The query also filters `user_id` explicitly: RLS is the last line of defense, the filter the first.
- The path serves `GET` and `POST` through `withMethods`; see [`POST /api/products`](products-create.md).
- The name search ignores the case and the brand search does not: `cerave` does not find the brand `CeraVe`.
- The substring search cannot use a regular index. It stays fast because the query only scans the rows of one user, found through the index `products_user_id_created_at_idx` on `(user_id, created_at desc)`.
- Limits live in [`shared/products.ts`](../../shared/products.ts).
