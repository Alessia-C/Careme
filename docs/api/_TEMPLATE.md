<!--
API endpoint documentation template.

How to use:
1. Copy this file to docs/api/<endpoint-name>.md (match the file name in api/).
2. Fill in every section. If a section does not apply, write "None" — do not delete it.
3. Add a row for the endpoint to docs/api/README.md.
4. Update the doc in the same PR whenever the endpoint's contract changes.
-->

# `METHOD /api/path`

One or two sentences: what the endpoint does and who calls it.

|            |                                                                                  |
| ---------- | -------------------------------------------------------------------------------- |
| **Method** | `GET` \| `POST` \| `PATCH` \| `PUT` \| `DELETE`                                  |
| **Path**   | `/api/path/:param`                                                               |
| **Source** | [`api/path.ts`](../../api/path.ts)                                               |
| **Auth**   | None \| Supabase user JWT (`Authorization: Bearer <access_token>`) \| Admin only |
| **Status** | Stable \| Experimental \| Deprecated                                             |

## Parameters

### Path parameters

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | `uuid` | Yes      | …           |

### Query parameters

| Name    | Type      | Required | Default | Description |
| ------- | --------- | -------- | ------- | ----------- |
| `limit` | `integer` | No       | `20`    | …           |

### Headers

| Name            | Required        | Description             |
| --------------- | --------------- | ----------------------- |
| `Authorization` | Yes             | `Bearer <access_token>` |
| `Content-Type`  | Yes (with body) | `application/json`      |

## Request body

`Content-Type: application/json`

| Field  | Type     | Required | Constraints | Description |
| ------ | -------- | -------- | ----------- | ----------- |
| `name` | `string` | Yes      | 1–100 chars | …           |

```json
{
  "name": "example"
}
```

## Response

### `200 OK`

| Field | Type   | Description |
| ----- | ------ | ----------- |
| `id`  | `uuid` | …           |

```json
{
  "id": "00000000-0000-0000-0000-000000000000"
}
```

## Error cases

All errors return JSON shaped `{ "status": "error", "message": string }` unless stated otherwise.

| Status                      | When                                                             | Example body                                           |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| `400 Bad Request`           | Body or parameters fail validation                               | `{ "status": "error", "message": "name is required" }` |
| `401 Unauthorized`          | Missing or invalid token                                         | …                                                      |
| `403 Forbidden`             | Authenticated but not allowed (e.g. not the owner, blocked user) | …                                                      |
| `404 Not Found`             | Resource does not exist or is not visible to the caller          | …                                                      |
| `405 Method Not Allowed`    | Unsupported HTTP method                                          | …                                                      |
| `500 Internal Server Error` | Unexpected server or database error                              | …                                                      |

## Example

```bash
curl -X METHOD http://localhost:3000/api/path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"example"}'
```

## Notes

Side effects, RLS policies involved, rate limits, idempotency, related endpoints — or "None".
